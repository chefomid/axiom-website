"""Build three-lane evidence bundles for SOV reconciliation."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from engine.models import Observation, TrustedValue

REGISTRY_DIR = Path(__file__).resolve().parent.parent.parent / "registry"

VENDOR_SOURCE_IDS = frozenset(
    {"attom_property", "melissa_property", "rentcast_property", "corelogic_property"}
)
ONLINE_SOURCE_IDS = frozenset(
    {
        "web_property_research",
        "assessor_crawl",
        "permit_crawl",
        "crawl4ai_heuristic",
        "osm_footprint",
        "county_parcel",
    }
)
VISUAL_SOURCE_ID = "vision_construction"

WEB_FIELD_MAP = {
    "yearBuilt": "year_built",
    "squareFootage": "square_footage",
    "stories": "stories",
    "constructionType": "construction_type",
    "roofType": "roof_type",
    "propertyType": "property_type",
    "ownerName": "owner_name",
    "occupancyUse": "occupancy_use",
    "parcelNumber": "parcel_number",
    "zoning": "zoning",
    "assessedValue": "assessed_value",
    "isoConstructionClass": "iso_construction_class",
}


@lru_cache(maxsize=1)
def load_sov_schema() -> dict[str, Any]:
    path = REGISTRY_DIR / "sov_fields.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def sov_field_ids() -> list[str]:
    return [f["id"] for f in load_sov_schema().get("fields", [])]


def critical_sov_field_ids() -> list[str]:
    return list(load_sov_schema().get("critical_fields") or [])


def _obs_entry(obs: Observation) -> dict[str, str]:
    return {
        "value": obs.raw_value,
        "source": obs.source,
        "source_id": obs.source_id or obs.source,
        "confidence": obs.confidence,
    }


def _lane_field_map(entries: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = {}
    for entry in entries:
        field_id = entry.get("field_id")
        if not field_id:
            continue
        grouped.setdefault(field_id, []).append(
            {k: v for k, v in entry.items() if k != "field_id"}
        )
    return grouped


def build_vendor_lane(observations: list[Observation]) -> dict[str, list[dict[str, str]]]:
    entries: list[dict[str, str]] = []
    for obs in observations:
        sid = obs.source_id or obs.source
        if sid not in VENDOR_SOURCE_IDS:
            continue
        if obs.field_id not in sov_field_ids():
            continue
        entries.append({"field_id": obs.field_id, **_obs_entry(obs)})
    return _lane_field_map(entries)


def build_online_lane(
    observations: list[Observation],
    *,
    web_research_run: Any | None = None,
    crawl_excerpt: str | None = None,
) -> dict[str, Any]:
    entries: list[dict[str, str]] = []
    for obs in observations:
        sid = obs.source_id or obs.source
        if sid not in ONLINE_SOURCE_IDS:
            continue
        if obs.field_id not in sov_field_ids():
            continue
        entries.append({"field_id": obs.field_id, **_obs_entry(obs)})

    web_fields: dict[str, str] = {}
    citations: list[dict[str, str]] = []
    web_summary: str | None = None
    if web_research_run and web_research_run.status == "success":
        for obs in web_research_run.observations or []:
            if obs.field_id in sov_field_ids():
                entries.append({"field_id": obs.field_id, **_obs_entry(obs)})
        raw = {}
        for f in web_research_run.fields or []:
            key = f.get("key")
            val = f.get("value")
            if key and val:
                raw[key] = val
        for web_key, field_id in WEB_FIELD_MAP.items():
            if raw.get(web_key) and field_id not in {e["field_id"] for e in entries}:
                web_fields[field_id] = str(raw[web_key])
                entries.append(
                    {
                        "field_id": field_id,
                        "value": str(raw[web_key]),
                        "source": "web_search",
                        "source_id": "web_property_research",
                        "confidence": "medium",
                    }
                )
        web_summary = web_research_run.message

    return {
        "fields": _lane_field_map(entries),
        "web_summary": web_summary,
        "crawl_excerpt": (crawl_excerpt or "")[:800] or None,
    }


def build_visual_lane(vision_analysis: dict[str, Any] | None) -> dict[str, Any]:
    if not vision_analysis:
        return {"fields": {}, "present": False}

    fields: dict[str, list[dict[str, str]]] = {}
    conf = vision_analysis.get("confidence") or "low"

    def add(field_id: str, value: Any) -> None:
        if value is None or str(value).strip() == "":
            return
        fields.setdefault(field_id, []).append(
            {
                "value": str(value),
                "source": "vision_construction",
                "source_id": VISUAL_SOURCE_ID,
                "confidence": conf,
            }
        )

    add("stories", vision_analysis.get("stories_visible"))
    add("construction_type", vision_analysis.get("facade_material"))
    if vision_analysis.get("iso_class") or vision_analysis.get("iso_label"):
        iso = " — ".join(
            x for x in (vision_analysis.get("iso_class"), vision_analysis.get("iso_label")) if x
        )
        add("iso_construction_class", iso)
    roof_parts = [vision_analysis.get("roof_material"), vision_analysis.get("roof_shape")]
    roof = " — ".join(p for p in roof_parts if p)
    if roof:
        add("roof_type", roof)

    return {
        "present": True,
        "fields": fields,
        "subject_identified": vision_analysis.get("subject_identified"),
        "subject_description": vision_analysis.get("subject_description"),
        "floor_levels": vision_analysis.get("floor_levels") or [],
        "limitations": vision_analysis.get("limitations") or [],
        "summary": vision_analysis.get("summary"),
    }


def build_evidence_lanes(
    observations: list[Observation],
    *,
    vision_analysis: dict[str, Any] | None,
    web_research_run: Any | None = None,
    crawl_excerpt: str | None = None,
    trusted: dict[str, TrustedValue],
    conflicts: list[dict[str, Any]],
) -> dict[str, Any]:
    vendor = build_vendor_lane(observations)
    online = build_online_lane(
        observations,
        web_research_run=web_research_run,
        crawl_excerpt=crawl_excerpt,
    )
    visual = build_visual_lane(vision_analysis)

    lanes_with_data = sum(
        1
        for lane_data in (
            vendor,
            online.get("fields") or {},
            visual.get("fields") or {},
        )
        if lane_data
    )

    baseline = {}
    for field_id in sov_field_ids():
        tv = trusted.get(field_id)
        if tv and tv.status == "observed" and tv.value:
            baseline[field_id] = {
                "value": tv.value,
                "source": tv.source,
                "method": tv.method,
                "confidence": tv.confidence,
            }

    conflict_fields = {c["field_id"]: c for c in conflicts if c.get("field_id") in sov_field_ids()}

    return {
        "vendor_api": vendor,
        "online_public": online,
        "visual_ai": visual,
        "lanes_with_data": lanes_with_data,
        "deterministic_baseline": baseline,
        "conflicts": conflict_fields,
    }


def lane_disagreement_on_field(
    lanes: dict[str, Any],
    field_id: str,
) -> bool:
    """True when two+ lanes supply different values for a SOV field."""
    values: set[str] = set()

    for entry in (lanes.get("vendor_api") or {}).get(field_id) or []:
        values.add(str(entry.get("value", "")).strip().lower())
    for entry in ((lanes.get("online_public") or {}).get("fields") or {}).get(field_id) or []:
        values.add(str(entry.get("value", "")).strip().lower())
    for entry in ((lanes.get("visual_ai") or {}).get("fields") or {}).get(field_id) or []:
        values.add(str(entry.get("value", "")).strip().lower())

    values.discard("")
    return len(values) > 1
