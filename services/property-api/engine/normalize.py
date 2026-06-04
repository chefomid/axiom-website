"""Normalize vendor values into canonical observations."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from engine.models import Observation

REGISTRY_DIR = Path(__file__).resolve().parent.parent / "registry"
MAPPINGS_DIR = REGISTRY_DIR / "mappings"

STORIES_MAP = {
    "bi-level": "2",
    "bi level": "2",
    "split-level": "2",
    "split level": "2",
    "single story": "1",
    "one story": "1",
    "two story": "2",
    "three story": "3",
}


@lru_cache(maxsize=64)
def load_field_map(source_id: str) -> dict[str, Any]:
    path = MAPPINGS_DIR / f"{source_id}.yaml"
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _get_path(data: dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def normalize_value(raw: Any, field_type: str, *, lowercase: bool = False) -> Any:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None

    if field_type == "integer":
        cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
        if not cleaned:
            return None
        try:
            return int(float(cleaned))
        except ValueError:
            return None

    if field_type == "year":
        match = re.search(r"\b(1[89]\d{2}|20\d{2})\b", text)
        return int(match.group(1)) if match else None

    if field_type == "stories":
        lower = text.lower()
        if lower in STORIES_MAP:
            return STORIES_MAP[lower]
        num = re.search(r"(\d+(?:\.\d+)?)", text)
        return num.group(1) if num else (lower if lowercase else text)

    if field_type == "float":
        cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
        try:
            return float(cleaned) if cleaned else None
        except ValueError:
            return None

    normalized = re.sub(r"\s+", " ", text)
    return normalized.lower() if lowercase else normalized


def format_display(value: Any, field_type: str, unit: str | None = None) -> str:
    if value is None:
        return ""
    if field_type == "integer" and unit == "sqft":
        return f"{value:,} sq ft"
    if field_type == "year":
        return str(value)
    return str(value)


def observations_from_mapping(
    raw_data: dict[str, Any],
    source_id: str,
    *,
    source_bucket: str | None = None,
) -> list[Observation]:
    mapping = load_field_map(source_id)
    if not mapping:
        return []
    bucket = source_bucket or source_id
    observations: list[Observation] = []
    for field_id, spec in mapping.items():
        if not isinstance(spec, dict):
            continue
        path = spec.get("path", field_id)
        raw = _get_path(raw_data, path) if "." in path else raw_data.get(path)
        if raw is None:
            continue
        field_type = spec.get("type", "string")
        lowercase = bool(spec.get("lowercase"))
        normalized = normalize_value(raw, field_type, lowercase=lowercase)
        if normalized is None:
            continue
        observations.append(
            Observation(
                field_id=field_id,
                raw_value=str(raw).strip(),
                normalized_value=normalized,
                source=bucket,
                confidence=spec.get("confidence", "medium"),
                source_id=source_id,
            )
        )
    return observations


def observations_from_fields(
    fields: list[dict[str, Any]],
    source_id: str,
) -> list[Observation]:
    """Build observations from legacy field dicts using cope field types."""
    from merger.cope import FIELD_ALIASES, load_cope_schema

    schema_fields = {}
    for section in load_cope_schema().get("sections", []):
        for f in section.get("fields", []):
            schema_fields[f["id"]] = f

    observations: list[Observation] = []
    for f in fields:
        key = f.get("key")
        value = f.get("value")
        if not key or not value:
            continue
        field_id = FIELD_ALIASES.get(key, key)
        spec = schema_fields.get(field_id, {})
        field_type = spec.get("type", "string")
        normalized = normalize_value(value, field_type)
        observations.append(
            Observation(
                field_id=field_id,
                raw_value=str(value).strip(),
                normalized_value=normalized if normalized is not None else str(value).strip(),
                source=f.get("source") or source_id,
                confidence=f.get("confidence", "medium"),
                source_id=source_id,
            )
        )
    return observations


def result_with_observations(result: "SourceRunResult") -> "SourceRunResult":
    from engine.models import SourceRunResult

    if result.observations:
        return result
    obs = observations_from_fields(result.fields, result.source_id)
    mapping_obs = observations_from_mapping({}, result.source_id)
    all_obs = obs or mapping_obs
    if not all_obs and result.fields:
        all_obs = observations_from_fields(result.fields, result.source_id)
    result.observations = all_obs
    return result
