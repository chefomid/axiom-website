"""Property Inspector agent orchestrator."""

from __future__ import annotations

import time
from typing import Any

import httpx

from adapters.base import failed_result, success_result
from adapters.hazard_fetch import fetch_osm_building
from adapters.services.vision_iso import construction_display_value, infer_iso
from adapters.services.vision_schema import (
    VISION_DISCLAIMER,
    build_mapped_payload,
    has_actionable_cues,
    normalize_vision_response,
)
from agents.property_inspector.analyze import analyze_facade
from agents.property_inspector.digest import render_inspection_digest
from agents.property_inspector.orient import build_capture_plan
from agents.property_inspector.select_view import select_best_view
from agents.property_inspector.tools.satellite import fetch_satellite_image
from agents.property_inspector.tools.streetview import (
    InspectorImage,
    fetch_street_view_image,
    fetch_streetview_metadata,
    google_maps_api_key,
    serialize_imagery_captures,
)
from engine.models import SourceContext, SourceRunResult
from llm.openai_client import DEFAULT_VISION_MODEL, format_openai_http_error, openai_api_key

SOURCE_ID = "vision_construction"
AGENT_VERSION = 1


def _prior_construction_context(ctx: SourceContext) -> str:
    lines: list[str] = []
    for sid in ("attom_property", "melissa_property", "rentcast_property"):
        run = ctx.prior_results.get(sid)
        if not run or run.status != "success":
            continue
        for obs in run.observations or []:
            if obs.field_id == "construction_type" and obs.raw_value:
                lines.append(f"Prior {sid} construction_type: {obs.raw_value}")
            if obs.field_id == "year_built" and obs.raw_value:
                lines.append(f"Prior {sid} year_built: {obs.raw_value}")
    if not lines:
        return "No prior vendor construction data in this run."
    return "Existing vendor data (for comparison only):\n" + "\n".join(lines)


def _osm_crosscheck_note(osm_levels: list[str], stories_visible: int | None) -> str | None:
    if not osm_levels or stories_visible is None:
        return None
    for raw in osm_levels:
        try:
            osm_n = int(float(str(raw).strip()))
        except (TypeError, ValueError):
            continue
        if osm_n != stories_visible:
            return (
                f"OSM building:levels ({osm_n}) differs from visible story count ({stories_visible}) "
                "— verify against assessor records."
            )
    return None


def _build_limited_analysis(
    *,
    summary: str,
    limitations: list[str],
    imagery_used: list[str],
    agent_trace: dict[str, Any],
    inspection_digest_md: str,
    selection: dict[str, Any] | None = None,
) -> dict[str, Any]:
    analysis: dict[str, Any] = {
        "summary": summary,
        "evidence": [],
        "limitations": limitations,
        "rationale": [],
        "iso_class": None,
        "iso_label": None,
        "confidence": "low",
        "imagery_used": imagery_used,
        "disclaimer": VISION_DISCLAIMER,
        "facade_material": None,
        "roof_material": None,
        "roof_shape": None,
        "stories_visible": None,
        "floor_levels": [],
        "inspection_digest_md": inspection_digest_md,
        "agent_trace": agent_trace,
        "agent_version": AGENT_VERSION,
    }
    if selection:
        analysis["subject_identified"] = selection.get("subject_identified")
        analysis["subject_description"] = selection.get("subject_description")
    return analysis


def _attach_imagery_previews(
    analysis: dict[str, Any],
    *,
    images_by_id: dict[str, InspectorImage],
    street_images: list[InspectorImage],
    selected_image_id: str | None,
) -> dict[str, Any]:
    analysis["imagery_captures"] = serialize_imagery_captures(
        images_by_id,
        street_images=street_images,
        selected_image_id=selected_image_id,
    )
    return analysis


async def run_property_inspector(ctx: SourceContext, client: httpx.AsyncClient) -> SourceRunResult:
    api_key = openai_api_key()
    if not api_key:
        from adapters.base import skipped_result

        return skipped_result(SOURCE_ID, "OPENAI_API_KEY not configured")

    lat = ctx.geo.get("lat")
    lng = ctx.geo.get("lng")
    if lat is None or lng is None:
        return failed_result(SOURCE_ID, "Missing coordinates for imagery fetch")

    property_lat = float(lat)
    property_lng = float(lng)
    address = ctx.geo.get("display_name") or ctx.address
    prior_note = _prior_construction_context(ctx)

    agent_trace: dict[str, Any] = {
        "agent_version": AGENT_VERSION,
        "phases": [],
        "captures": [],
    }
    imagery_used: list[str] = []
    images_by_id: dict[str, InspectorImage] = {}

    # Phase 1 — orient + capture
    t0 = time.monotonic()
    satellite = await fetch_satellite_image(client, property_lat, property_lng)
    if satellite:
        images_by_id[satellite.image_id] = satellite
        imagery_used.append("satellite")

    gkey = google_maps_api_key()
    street_metadata = None
    street_images: list[InspectorImage] = []
    osm_data = await fetch_osm_building(client, property_lat, property_lng)

    if gkey:
        street_metadata = await fetch_streetview_metadata(client, property_lat, property_lng, gkey)

    plan = build_capture_plan(
        property_lat=property_lat,
        property_lng=property_lng,
        street_metadata=street_metadata,
        osm_levels=osm_data.get("levels") or [],
        osm_building_count=osm_data.get("count") or 0,
    )
    osm_levels = plan.osm_levels

    if gkey and street_metadata and street_metadata.status == "OK":
        for spec in plan.capture_specs:
            img = await fetch_street_view_image(
                client,
                lat=property_lat,
                lng=property_lng,
                api_key=gkey,
                image_id=spec.image_id,
                label=spec.label,
                heading=spec.heading,
                pitch=spec.pitch,
                fov=spec.fov,
            )
            if img:
                street_images.append(img)
                images_by_id[img.image_id] = img
                agent_trace["captures"].append(
                    {"image_id": img.image_id, "heading": img.heading, "pitch": img.pitch}
                )
        if street_images:
            imagery_used.append("street")
        agent_trace["bearing_deg"] = plan.bearing_deg
        agent_trace["osm_levels"] = plan.osm_levels

    agent_trace["phases"].append(
        {
            "name": "orient",
            "latency_ms": int((time.monotonic() - t0) * 1000),
            "detail": f"Captured {len(street_images)} street view(s), satellite={'yes' if satellite else 'no'}",
        }
    )

    if not images_by_id:
        return failed_result(SOURCE_ID, "Could not fetch satellite or street imagery")

    satellite_only = not street_images

    # Phase 2 — select view
    selection: dict[str, Any] = {
        "selected_image_id": satellite.image_id if satellite_only and satellite else "",
        "subject_identified": False,
        "subject_description": None,
        "confidence": "low",
        "rejected_views": [],
    }

    if street_images:
        t1 = time.monotonic()
        try:
            selection = await select_best_view(
                client=client,
                api_key=api_key,
                address=address,
                lat=property_lat,
                lng=property_lng,
                street_images=street_images,
                satellite=satellite,
            )
        except httpx.HTTPStatusError as e:
            return failed_result(
                SOURCE_ID,
                format_openai_http_error(e, context="Property Inspector view selection"),
            )
        except Exception as e:
            return failed_result(SOURCE_ID, f"View selection failed: {e}")

        agent_trace["phases"].append(
            {
                "name": "select",
                "latency_ms": int((time.monotonic() - t1) * 1000),
                "detail": (
                    f"Selected {selection.get('selected_image_id')} "
                    f"(subject_identified={selection.get('subject_identified')})"
                ),
            }
        )
        agent_trace["select_model"] = selection.get("model")

    if street_images and not selection.get("subject_identified"):
        limitations = [
            "Subject building could not be confirmed in any Street View capture",
            "Construction and story count omitted — verify manually or re-run with better coverage",
        ]
        digest = render_inspection_digest(
            address=address,
            lat=property_lat,
            lng=property_lng,
            vision={"summary": "Subject building not identified in Street View.", "limitations": limitations},
            iso_result={},
            selection=selection,
            agent_trace=agent_trace,
            imagery_used=imagery_used,
            subject_description=selection.get("subject_description"),
            satellite_only=satellite_only,
        )
        analysis = _attach_imagery_previews(
            _build_limited_analysis(
                summary="Subject building not identified in Street View captures.",
                limitations=limitations,
                imagery_used=imagery_used,
                agent_trace=agent_trace,
                inspection_digest_md=digest,
                selection=selection,
            ),
            images_by_id=images_by_id,
            street_images=street_images,
            selected_image_id=selection.get("selected_image_id"),
        )
        result = SourceRunResult(
            SOURCE_ID,
            status="success",
            message=analysis["summary"],
            charged=True,
            analysis=analysis,
        )
        return result

    selected_id = selection.get("selected_image_id") or (satellite.image_id if satellite else "")
    selected = images_by_id.get(selected_id)
    if not selected and street_images:
        selected = street_images[0]
        selected_id = selected.image_id
    if not selected and satellite:
        selected = satellite
        selected_id = satellite.image_id

    agent_trace["selected_view"] = {
        "id": selected_id,
        "heading": selected.heading if selected else None,
        "pitch": selected.pitch if selected else 0,
    }

    # Phase 3 — analyze (skip deep analysis if satellite-only without street confirmation)
    vision: dict[str, Any] = {
        "summary": "Satellite-only context — limited construction cues.",
        "limitations": [],
    }
    iso_result: dict[str, Any] = {}

    if selected and not satellite_only:
        t2 = time.monotonic()
        try:
            parsed, _ = await analyze_facade(
                client=client,
                api_key=api_key,
                address=address,
                lat=property_lat,
                lng=property_lng,
                selected=selected,
                satellite=satellite,
                prior_note=prior_note,
                subject_description=selection.get("subject_description"),
            )
        except httpx.HTTPStatusError as e:
            return failed_result(
                SOURCE_ID,
                format_openai_http_error(e, context="Property Inspector facade analysis"),
            )
        except Exception as e:
            return failed_result(SOURCE_ID, f"Facade analysis failed: {e}")

        vision = normalize_vision_response(parsed, satellite_only=False)
        crosscheck = _osm_crosscheck_note(osm_levels, vision.get("storiesVisible"))
        if crosscheck:
            vision["limitations"] = list(vision.get("limitations") or []) + [crosscheck]

        agent_trace["phases"].append(
            {
                "name": "analyze",
                "latency_ms": int((time.monotonic() - t2) * 1000),
                "detail": f"Analyzed {selected_id} with {DEFAULT_VISION_MODEL}",
            }
        )
        agent_trace["selected_model"] = DEFAULT_VISION_MODEL

    elif satellite_only and satellite:
        t2 = time.monotonic()
        try:
            parsed, _ = await analyze_facade(
                client=client,
                api_key=api_key,
                address=address,
                lat=property_lat,
                lng=property_lng,
                selected=satellite,
                satellite=None,
                prior_note=prior_note,
                subject_description="building footprint at pin (satellite only)",
            )
        except httpx.HTTPStatusError as e:
            return failed_result(
                SOURCE_ID,
                format_openai_http_error(e, context="Property Inspector satellite analysis"),
            )
        except Exception as e:
            return failed_result(SOURCE_ID, f"Satellite analysis failed: {e}")

        vision = normalize_vision_response(parsed, satellite_only=True)
        agent_trace["phases"].append(
            {
                "name": "analyze",
                "latency_ms": int((time.monotonic() - t2) * 1000),
                "detail": f"Satellite-only analysis with {DEFAULT_VISION_MODEL}",
            }
        )
        agent_trace["selected_model"] = DEFAULT_VISION_MODEL

    if not has_actionable_cues(vision):
        digest = render_inspection_digest(
            address=address,
            lat=property_lat,
            lng=property_lng,
            vision=vision,
            iso_result={},
            selection=selection,
            agent_trace=agent_trace,
            imagery_used=imagery_used,
            subject_description=selection.get("subject_description"),
            satellite_only=satellite_only,
        )
        analysis = _attach_imagery_previews(
            _build_limited_analysis(
                summary=vision.get("summary") or "No actionable construction cues from imagery",
                limitations=list(vision.get("limitations") or []),
                imagery_used=imagery_used,
                agent_trace=agent_trace,
                inspection_digest_md=digest,
                selection=selection,
            ),
            images_by_id=images_by_id,
            street_images=street_images,
            selected_image_id=selected_id,
        )
        return SourceRunResult(
            SOURCE_ID,
            status="success",
            message=analysis["summary"],
            charged=True,
            analysis=analysis,
        )

    iso_result = infer_iso(vision)
    construction = construction_display_value(vision, iso_result)
    mapped = build_mapped_payload(
        vision,
        iso_class=iso_result.get("iso_class"),
        iso_label=iso_result.get("iso_label"),
        iso_confidence=iso_result.get("confidence_cap") or "low",
        construction_display=construction,
    )

    all_limitations = list(vision.get("limitations") or [])
    all_limitations.extend(iso_result.get("limitations") or [])

    digest = render_inspection_digest(
        address=address,
        lat=property_lat,
        lng=property_lng,
        vision=vision,
        iso_result=iso_result,
        selection=selection,
        agent_trace=agent_trace,
        imagery_used=imagery_used,
        subject_description=selection.get("subject_description"),
        satellite_only=satellite_only,
    )

    analysis = _attach_imagery_previews(
        {
            "summary": vision.get("summary"),
            "evidence": vision.get("evidence") or [],
            "limitations": all_limitations,
            "rationale": iso_result.get("rationale") or [],
            "iso_class": iso_result.get("iso_class"),
            "iso_label": iso_result.get("iso_label"),
            "confidence": iso_result.get("confidence_cap") or vision.get("confidence"),
            "imagery_used": imagery_used,
            "disclaimer": VISION_DISCLAIMER,
            "facade_material": vision.get("facadeMaterial"),
            "roof_material": vision.get("roofMaterial"),
            "roof_shape": vision.get("roofShape"),
            "stories_visible": vision.get("storiesVisible"),
            "floor_levels": vision.get("floorLevels") or [],
            "inspection_digest_md": digest,
            "agent_trace": agent_trace,
            "agent_version": AGENT_VERSION,
            "subject_identified": selection.get("subject_identified"),
            "subject_description": selection.get("subject_description"),
        },
        images_by_id=images_by_id,
        street_images=street_images,
        selected_image_id=selected_id,
    )

    result = success_result(
        SOURCE_ID,
        raw_data=mapped,
        source_bucket="vision_construction",
        message=vision.get("summary") or "Property Inspector analysis complete",
    )
    result.analysis = analysis
    return result
