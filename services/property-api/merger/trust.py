"""Resolve one trusted value per COPE field from normalized observations."""

from __future__ import annotations

from typing import Any

from engine.models import Observation, TrustedValue, TrustMethod
from engine.normalize import format_display
from merger.cope import SOURCE_BUCKETS, load_cope_schema


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


def _field_spec(field_id: str) -> dict[str, Any]:
    for section in load_cope_schema().get("sections", []):
        for field in section.get("fields", []):
            if field["id"] == field_id:
                return field
    return {}


def _within_tolerance(a: Any, b: Any, spec: dict[str, Any]) -> bool:
    field_type = spec.get("type", "string")
    if field_type not in ("integer", "float"):
        return str(a).strip().lower() == str(b).strip().lower()
    try:
        na, nb = float(a), float(b)
    except (TypeError, ValueError):
        return False
    if na == nb:
        return True
    tolerance_pct = spec.get("tolerance_pct")
    if tolerance_pct is None:
        return False
    if na == 0 or nb == 0:
        return na == nb
    diff_pct = abs(na - nb) / max(abs(na), abs(nb)) * 100
    return diff_pct <= tolerance_pct


def _pick_best_observation(observations: list[Observation], field_id: str) -> Observation:
    conf_order = {"high": 0, "medium": 1, "low": 2, "unknown": 3}

    def sort_key(o: Observation) -> tuple:
        return (_precedence_rank(field_id, o.source), conf_order.get(o.confidence, 9))

    return min(observations, key=sort_key)


def _group_equivalent(observations: list[Observation], spec: dict[str, Any]) -> list[list[Observation]]:
    groups: list[list[Observation]] = []
    for obs in observations:
        placed = False
        for group in groups:
            if _within_tolerance(obs.normalized_value, group[0].normalized_value, spec):
                group.append(obs)
                placed = True
                break
        if not placed:
            groups.append([obs])
    return groups


def resolve_field(field_id: str, observations: list[Observation]) -> tuple[TrustedValue, bool]:
    spec = _field_spec(field_id)
    field_type = spec.get("type", "string")
    unit = spec.get("unit")

    if not observations:
        return TrustedValue(
            field_id=field_id,
            value=None,
            display_value=None,
            source=None,
            confidence="unknown",
            method="unknown",
            status="unknown",
        ), False

    groups = _group_equivalent(observations, spec)
    best = _pick_best_observation(observations, field_id)

    if len(groups) == 1:
        method: TrustMethod = "unanimous" if len(observations) > 1 else "precedence"
        has_conflict = False
    else:
        ref = best.normalized_value
        agreeing = sum(
            1 for g in groups
            if _within_tolerance(g[0].normalized_value, ref, spec)
        )
        if agreeing > 1:
            method = "tolerance"
            has_conflict = False
        else:
            method = "precedence"
            has_conflict = True

    display = format_display(best.normalized_value, field_type, unit) or best.raw_value
    alternatives = [
        {"value": o.raw_value, "source": o.source, "confidence": o.confidence}
        for o in observations
        if o.source != best.source or o.raw_value != best.raw_value
    ]

    return TrustedValue(
        field_id=field_id,
        value=str(best.normalized_value) if best.normalized_value is not None else best.raw_value,
        display_value=display,
        source=best.source,
        confidence=best.confidence,
        method=method,
        status="observed",
        alternatives=alternatives,
        conflict=has_conflict,
    ), has_conflict


def resolve_all(observations: list[Observation]) -> tuple[dict[str, TrustedValue], list[dict[str, Any]]]:
    grouped: dict[str, list[Observation]] = {}
    for obs in observations:
        grouped.setdefault(obs.field_id, []).append(obs)

    trusted: dict[str, TrustedValue] = {}
    conflicts: list[dict[str, Any]] = []

    schema = load_cope_schema()
    all_field_ids: list[str] = []
    for section in schema.get("sections", []):
        for field in section.get("fields", []):
            all_field_ids.append(field["id"])

    for field_id in all_field_ids:
        tv, is_conflict = resolve_field(field_id, grouped.get(field_id, []))
        trusted[field_id] = tv
        if is_conflict:
            conflicts.append(
                {
                    "field_id": field_id,
                    "alternatives": [
                        {"value": o.raw_value, "source": o.source, "confidence": o.confidence}
                        for o in grouped.get(field_id, [])
                    ],
                }
            )

    return trusted, conflicts


def collect_observations_from_results(results: list[Any]) -> list[Observation]:
    observations: list[Observation] = []
    for run in results:
        if hasattr(run, "observations") and run.observations:
            observations.extend(run.observations)
        elif hasattr(run, "fields") and run.fields:
            from engine.normalize import observations_from_fields
            observations.extend(observations_from_fields(run.fields, run.source_id))
    return observations
