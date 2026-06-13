"""Apply SOV orchestrator resolutions to trusted COPE values."""

from __future__ import annotations

from typing import Any

from agents.sov_orchestrator.lanes import sov_field_ids
from engine.models import TrustedValue
from engine.normalize import format_display
from merger.trust import _field_spec


def _within_tolerance(a: Any, b: Any, field_id: str) -> bool:
    spec = _field_spec(field_id)
    field_type = spec.get("type", "string")
    if field_type not in ("integer", "float", "year", "stories"):
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


def apply_orchestrator_result(
    trusted: dict[str, TrustedValue],
    result: dict[str, Any],
    *,
    original_conflicts: list[dict[str, Any]],
) -> tuple[dict[str, TrustedValue], list[dict[str, Any]]]:
    adjusted = dict(trusted)
    sov_ids = set(sov_field_ids())

    conflict_map = {c["field_id"]: c for c in original_conflicts}

    for disc in result.get("discrepancies") or []:
        field_id = disc.get("field_id")
        if field_id not in sov_ids:
            continue
        if disc.get("status") != "resolved":
            continue
        resolved = disc.get("resolved_value")
        if resolved is None or str(resolved).strip() == "":
            continue

        current = adjusted.get(field_id)
        if current and current.value and _within_tolerance(current.value, resolved, field_id):
            continue

        spec = _field_spec(field_id)
        display = format_display(resolved, spec.get("type", "string"), spec.get("unit")) or str(resolved)
        alts = conflict_map.get(field_id, {}).get("alternatives") or (current.alternatives if current else [])

        sov_entry = (result.get("statement_of_values") or {}).get(field_id) or {}
        adjusted[field_id] = TrustedValue(
            field_id=field_id,
            value=str(resolved),
            display_value=display,
            source=sov_entry.get("primary_source") or "sov_orchestrator",
            confidence=sov_entry.get("confidence") or "medium",
            method="llm",
            status="observed",
            alternatives=alts,
            conflict=False,
        )

    for enrich in result.get("enrichments") or []:
        field_id = enrich.get("field_id")
        if field_id not in sov_ids:
            continue
        current = adjusted.get(field_id)
        if current and current.status == "observed" and current.value:
            continue
        value = enrich.get("value")
        if value is None:
            continue
        spec = _field_spec(field_id)
        display = format_display(value, spec.get("type", "string"), spec.get("unit")) or str(value)
        adjusted[field_id] = TrustedValue(
            field_id=field_id,
            value=str(value),
            display_value=display,
            source=enrich.get("source") or "sov_orchestrator",
            confidence="medium",
            method="llm",
            status="observed",
            alternatives=[],
            conflict=False,
        )

    remaining_conflicts: list[dict[str, Any]] = []
    for conflict in original_conflicts:
        field_id = conflict.get("field_id")
        if field_id not in sov_ids:
            remaining_conflicts.append(conflict)
            continue
        disc = next((d for d in (result.get("discrepancies") or []) if d.get("field_id") == field_id), None)
        if disc:
            entry = {**conflict, "rationale": disc.get("rationale")}
            if disc.get("status") == "resolved":
                entry["resolved_by"] = "sov_orchestrator"
                if disc.get("rationale"):
                    remaining_conflicts.append(entry)
                continue
            remaining_conflicts.append(entry)
            continue
        tv = adjusted.get(field_id)
        if tv and tv.conflict:
            remaining_conflicts.append(conflict)

    return adjusted, remaining_conflicts
