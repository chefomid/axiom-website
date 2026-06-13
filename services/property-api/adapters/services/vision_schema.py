"""Parse and validate OpenAI vision JSON for construction analysis."""

from __future__ import annotations

import json
import re
from typing import Any

CONFIDENCE_LEVELS = frozenset({"high", "medium", "low"})

VISION_DISCLAIMER = (
    "AI-assisted visual estimate from satellite and/or Street View imagery. "
    "Verify against vendor records, assessor data, or inspection before underwriting."
)


def parse_vision_json(text: str) -> dict[str, Any]:
    """Extract JSON object from model response."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def normalize_confidence(value: Any) -> str:
    text = str(value or "medium").strip().lower()
    return text if text in CONFIDENCE_LEVELS else "medium"


def _clean_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _clean_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = _clean_str(item)
        if text:
            out.append(text)
    return out


def _clean_evidence(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        feature = _clean_str(item.get("feature"))
        if not feature:
            continue
        out.append(
            {
                "feature": feature,
                "image": _clean_str(item.get("image")) or "unknown",
                "note": _clean_str(item.get("note")) or "",
            }
        )
    return out


def _clean_floor_levels(value: Any) -> list[dict[str, str | int]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, str | int]] = []
    for idx, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            continue
        feature = _clean_str(item.get("feature"))
        if not feature:
            continue
        level_raw = item.get("level")
        level = idx
        if level_raw is not None:
            try:
                level = int(float(level_raw))
            except (TypeError, ValueError):
                level = idx
        out.append(
            {
                "level": level,
                "feature": feature,
                "image": _clean_str(item.get("image")) or "unknown",
            }
        )
    return out


def _parse_stories_value(value: Any) -> int | None:
    if value is None:
        return None
    try:
        n = int(float(value))
    except (TypeError, ValueError):
        return None
    return n if 1 <= n <= 99 else None


def resolve_stories_visible(
    *,
    raw_stories: Any,
    floor_levels: list[dict[str, str | int]],
    satellite_only: bool,
) -> int | None:
    """Derive story count from enumerated floor bands when available."""
    if satellite_only:
        return None
    if floor_levels:
        return len(floor_levels)
    return _parse_stories_value(raw_stories)


def normalize_vision_response(raw: dict[str, Any], *, satellite_only: bool) -> dict[str, Any]:
    """Validate and normalize LLM vision output."""
    confidence = normalize_confidence(raw.get("confidence"))
    if satellite_only and confidence == "high":
        confidence = "medium"
    if satellite_only:
        confidence = "low" if confidence == "medium" else confidence

    floor_levels = _clean_floor_levels(raw.get("floorLevels"))
    stories_int = resolve_stories_visible(
        raw_stories=raw.get("storiesVisible"),
        floor_levels=floor_levels,
        satellite_only=satellite_only,
    )
    declared_stories = _parse_stories_value(raw.get("storiesVisible"))
    if (
        floor_levels
        and declared_stories is not None
        and declared_stories != len(floor_levels)
        and confidence == "high"
    ):
        confidence = "medium"

    normalized = {
        "facadeMaterial": _clean_str(raw.get("facadeMaterial")),
        "roofMaterial": _clean_str(raw.get("roofMaterial")),
        "roofShape": _clean_str(raw.get("roofShape")),
        "floorLevels": floor_levels,
        "storiesVisible": stories_int,
        "structuralClues": _clean_str_list(raw.get("structuralClues")),
        "constructionTypeEstimate": _clean_str(raw.get("constructionTypeEstimate")),
        "confidence": confidence,
        "evidence": _clean_evidence(raw.get("evidence")),
        "limitations": _clean_str_list(raw.get("limitations")),
        "summary": _clean_str(raw.get("summary")),
    }

    if satellite_only:
        limitations = list(normalized["limitations"])
        limitation = "Street View unavailable — analysis based on satellite imagery only"
        if limitation not in limitations:
            limitations.insert(0, limitation)
        story_limitation = "Story count omitted — cannot reliably count floors from satellite imagery alone"
        if story_limitation not in limitations:
            limitations.append(story_limitation)
        normalized["limitations"] = limitations

    return normalized


def has_actionable_cues(data: dict[str, Any]) -> bool:
    return bool(
        data.get("constructionTypeEstimate")
        or data.get("facadeMaterial")
        or data.get("roofMaterial")
    )


def build_roof_type_label(roof_material: str | None, roof_shape: str | None) -> str | None:
    parts = [p for p in (roof_material, roof_shape) if p]
    if not parts:
        return None
    return " — ".join(parts)


def build_mapped_payload(
    vision: dict[str, Any],
    *,
    iso_class: str | None,
    iso_label: str | None,
    iso_confidence: str,
    construction_display: str | None,
) -> dict[str, Any]:
    """Payload for YAML field mapping."""
    mapped: dict[str, Any] = {}
    if construction_display:
        mapped["constructionType"] = construction_display
    if iso_class and iso_label:
        mapped["isoConstructionClass"] = f"{iso_class} — {iso_label}"
    roof = build_roof_type_label(vision.get("roofMaterial"), vision.get("roofShape"))
    if roof:
        mapped["roofType"] = roof
    if vision.get("storiesVisible") is not None:
        mapped["stories"] = str(vision["storiesVisible"])
    return mapped
