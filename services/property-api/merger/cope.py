"""Build COPE snapshot from collected property fields."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

REGISTRY_DIR = Path(__file__).resolve().parent.parent / "registry"

SOURCE_BUCKETS: dict[str, str] = {
    "us_census": "geocoder",
    "nominatim": "geocoder",
    "photon": "geocoder",
    "fema_nfhl": "fema_nfhl",
    "nws": "nws",
    "usgs": "usgs",
    "nasa_eonet": "nasa_eonet",
    "open_meteo": "open_meteo",
    "osm": "osm",
    "rentcast": "rentcast",
    "attom": "attom",
    "corelogic": "corelogic",
    "melissa": "melissa",
    "regrid": "regrid",
    "crawl4ai_heuristic": "assessor_crawl",
    "assessor_crawl": "assessor_crawl",
    "permit_crawl": "permit_crawl",
    "county_parcel": "county_parcel",
    "epa_echo": "epa_echo",
    "firststreet": "firststreet",
    "attom_hazard": "attom_hazard",
    "fire_station_gis": "fire_station_gis",
    "hydrant_gis": "hydrant_gis",
    "poi_exposure": "poi_exposure",
}

EXPOSURE_FIELD_IDS = frozenset(
    {
        "flood_zone",
        "flood_summary",
        "seismic_summary",
        "wildfire_summary",
        "nws_alerts",
        "air_quality",
        "adjacent_exposure",
        "environmental_facilities",
    }
)
PROTECTION_FIELD_IDS = frozenset(
    {"sprinkler_status", "fire_alarm", "fire_station_distance", "hydrant_proximity"}
)


def unknown_field_note(field_id: str, *, sources_seen: set[str]) -> str:
    """Contextual hint when a COPE field has no trusted value."""
    has_attom = "attom" in sources_seen or "attom_hazard" in sources_seen

    if field_id in EXPOSURE_FIELD_IDS:
        if has_attom:
            return (
                "Hazard sources did not return this metric for this location — "
                "check FEMA/USGS/ATTOM hazard status in the receipt."
            )
        return "Run FEMA NFHL, USGS, NWS, or ATTOM hazard (included in COPE Insurance preset)."

    if field_id in PROTECTION_FIELD_IDS:
        return (
            "Protection fields need hydrant GIS, fire-station proximity, or permit/ATTOM data — "
            "enable those sources in Customize sources."
        )

    if has_attom:
        return "Not in the ATTOM property record for this address — try assessor crawl or CoreLogic."

    return "Add ATTOM, assessor crawl, or CoreLogic for carrier-grade certainty."


FIELD_ALIASES: dict[str, str] = {
    "year_built": "year_built",
    "square_footage": "square_footage",
    "osm_stories": "stories",
    "property_type": "property_type",
    "construction_type": "construction_type",
    "roof_type": "roof_type",
    "parcel_number": "parcel_number",
    "owner_name": "owner_name",
    "zoning": "zoning",
    "occupancy_use": "occupancy_use",
    "assessed_value": "assessed_value",
    "sprinkler_status": "sprinkler_status",
    "fire_alarm": "fire_alarm",
    "fire_station_distance": "fire_station_distance",
    "hydrant_proximity": "hydrant_proximity",
    "flood_zone": "flood_zone",
    "flood_summary": "flood_summary",
    "seismic_summary": "seismic_summary",
    "wildfire_summary": "wildfire_summary",
    "nws_alerts": "nws_alerts",
    "air_quality": "air_quality",
    "adjacent_exposure": "adjacent_exposure",
    "environmental_facilities": "environmental_facilities",
}


@lru_cache(maxsize=1)
def load_cope_schema() -> dict[str, Any]:
    with (REGISTRY_DIR / "cope_fields.json").open(encoding="utf-8") as f:
        return json.load(f)


def _precedence_rank(field_id: str, source: str) -> int:
    bucket = SOURCE_BUCKETS.get(source, source)
    for section in load_cope_schema().get("sections", []):
        for field in section.get("fields", []):
            if field["id"] == field_id:
                precedence = field.get("precedence") or []
                try:
                    return precedence.index(bucket)
                except ValueError:
                    return len(precedence) + 10
    return 999


def index_fields_by_cope_id(fields: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for f in fields:
        key = f.get("key")
        if not key or not f.get("value"):
            continue
        cope_id = FIELD_ALIASES.get(key, key)
        grouped.setdefault(cope_id, []).append(f)
    return grouped


def pick_best(values: list[dict[str, Any]], field_id: str) -> dict[str, Any] | None:
    if not values:
        return None
    conf_order = {"high": 0, "medium": 1, "low": 2, "unknown": 3}

    def sort_key(v: dict[str, Any]) -> tuple:
        return (_precedence_rank(field_id, v.get("source") or ""), conf_order.get(v.get("confidence"), 9))

    return min(values, key=sort_key)


def build_conflicts(grouped: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    for field_id, values in grouped.items():
        unique: dict[str, list] = {}
        for v in values:
            norm = str(v.get("value", "")).strip().lower()
            if norm:
                unique.setdefault(norm, []).append(v)
        if len(unique) > 1:
            conflicts.append(
                {
                    "field_id": field_id,
                    "alternatives": [
                        {"value": v["value"], "source": v.get("source"), "confidence": v.get("confidence")}
                        for v in values
                    ],
                }
            )
    return conflicts


def build_cope_snapshot_from_trusted(
    trusted: dict[str, Any],
    *,
    conflicts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build COPE snapshot from TrustResolver output."""
    schema = load_cope_schema()
    conflict_list = conflicts or []

    sections_out: list[dict[str, Any]] = []
    observed = 0
    unknown = 0
    total = 0
    sources_seen: set[str] = set()
    for tv in trusted.values():
        src = getattr(tv, "source", None) if not isinstance(tv, dict) else tv.get("source")
        status = getattr(tv, "status", None) if not isinstance(tv, dict) else tv.get("status")
        if src and status == "observed":
            sources_seen.add(str(src))

    for section in schema.get("sections", []):
        fields_out: list[dict[str, Any]] = []

        for field_def in section.get("fields", []):
            field_id = field_def["id"]
            total += 1
            tv = trusted.get(field_id)

            if tv and getattr(tv, "status", tv.get("status") if isinstance(tv, dict) else None) == "observed":
                observed += 1
                if isinstance(tv, dict):
                    value = tv.get("display_value") or tv.get("value")
                    fields_out.append({**tv, "id": field_id, "label": field_def["label"], "value": value})
                else:
                    fields_out.append(
                        {
                            "id": field_id,
                            "label": field_def["label"],
                            "value": tv.display_value or tv.value,
                            "source": tv.source,
                            "confidence": tv.confidence,
                            "method": tv.method,
                            "status": "observed",
                            "alternatives": tv.alternatives,
                        }
                    )
            else:
                unknown += 1
                fields_out.append(
                    {
                        "id": field_id,
                        "label": field_def["label"],
                        "value": None,
                        "source": None,
                        "confidence": "unknown",
                        "method": "unknown",
                        "status": "unknown",
                        "alternatives": [],
                        "note": unknown_field_note(field_id, sources_seen=sources_seen),
                    }
                )

        filled = sum(1 for f in fields_out if f["status"] == "observed")
        sections_out.append(
            {
                "id": section["id"],
                "label": section["label"],
                "cope_letter": section.get("cope_letter"),
                "completeness": f"{filled}/{len(fields_out)}",
                "fields": fields_out,
            }
        )

    return {
        "sections": sections_out,
        "score": {
            "observed": observed,
            "unknown": unknown,
            "total": total,
            "completeness_pct": round((observed / total) * 100) if total else 0,
        },
        "conflicts": conflict_list,
    }


def build_cope_snapshot(fields: list[dict[str, Any]]) -> dict[str, Any]:
    """Legacy path — resolve via TrustResolver then build snapshot."""
    from engine.normalize import observations_from_fields
    from merger.trust import resolve_all

    observations = observations_from_fields(fields, "legacy")
    trusted, conflicts = resolve_all(observations)
    return build_cope_snapshot_from_trusted(trusted, conflicts=conflicts)


def _build_cope_snapshot_legacy(fields: list[dict[str, Any]]) -> dict[str, Any]:
    schema = load_cope_schema()
    grouped = index_fields_by_cope_id(fields)
    conflicts = build_conflicts(grouped)

    sections_out: list[dict[str, Any]] = []
    observed = 0
    unknown = 0
    total = 0
    sources_seen: set[str] = set()
    for candidates in grouped.values():
        for c in candidates:
            if c.get("source"):
                sources_seen.add(str(c["source"]))

    for section in schema.get("sections", []):
        fields_out: list[dict[str, Any]] = []

        for field_def in section.get("fields", []):
            field_id = field_def["id"]
            total += 1
            candidates = grouped.get(field_id, [])
            best = pick_best(candidates, field_id)

            if best:
                observed += 1
                fields_out.append(
                    {
                        "id": field_id,
                        "label": field_def["label"],
                        "value": best.get("value"),
                        "source": best.get("source"),
                        "confidence": best.get("confidence", "medium"),
                        "status": "observed",
                        "alternatives": [
                            {"value": c["value"], "source": c.get("source"), "confidence": c.get("confidence")}
                            for c in candidates
                            if c is not best
                        ],
                    }
                )
            else:
                unknown += 1
                fields_out.append(
                    {
                        "id": field_id,
                        "label": field_def["label"],
                        "value": None,
                        "source": None,
                        "confidence": "unknown",
                        "status": "unknown",
                        "alternatives": [],
                        "note": unknown_field_note(field_id, sources_seen=sources_seen),
                    }
                )

        filled = sum(1 for f in fields_out if f["status"] == "observed")
        sections_out.append(
            {
                "id": section["id"],
                "label": section["label"],
                "cope_letter": section.get("cope_letter"),
                "completeness": f"{filled}/{len(fields_out)}",
                "fields": fields_out,
            }
        )

    return {
        "sections": sections_out,
        "score": {
            "observed": observed,
            "unknown": unknown,
            "total": total,
            "completeness_pct": round((observed / total) * 100) if total else 0,
        },
        "conflicts": conflicts,
    }


# Keep legacy helpers available for tests
build_cope_snapshot_legacy = _build_cope_snapshot_legacy
