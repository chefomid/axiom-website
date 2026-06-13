"""Parse and validate SOV orchestrator JSON output."""

from __future__ import annotations

import json
import re
from typing import Any

CONFIDENCE_LEVELS = frozenset({"high", "medium", "low"})


def parse_reconcile_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _clean_confidence(value: Any) -> str:
    text = str(value or "medium").strip().lower()
    return text if text in CONFIDENCE_LEVELS else "medium"


def _clean_sov_entry(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    val = value.get("value")
    if val is None or str(val).strip() == "":
        return None
    lanes = value.get("supporting_lanes") or value.get("supportingLanes") or []
    if not isinstance(lanes, list):
        lanes = []
    return {
        "value": str(val).strip(),
        "confidence": _clean_confidence(value.get("confidence")),
        "primary_source": str(value.get("primary_source") or value.get("primarySource") or "").strip() or None,
        "supporting_lanes": [str(x) for x in lanes if x],
    }


def normalize_orchestrator_response(raw: dict[str, Any]) -> dict[str, Any]:
    sov_raw = raw.get("statement_of_values") or raw.get("statementOfValues") or {}
    statement_of_values: dict[str, dict[str, Any]] = {}
    if isinstance(sov_raw, dict):
        for field_id, entry in sov_raw.items():
            cleaned = _clean_sov_entry(entry)
            if cleaned:
                statement_of_values[str(field_id)] = cleaned

    discrepancies: list[dict[str, Any]] = []
    for item in raw.get("discrepancies") or []:
        if not isinstance(item, dict):
            continue
        field_id = str(item.get("field_id") or item.get("fieldId") or "").strip()
        if not field_id:
            continue
        lane_values = item.get("lane_values") or item.get("laneValues") or {}
        status = str(item.get("status") or "unresolved").strip().lower()
        if status not in {"resolved", "unresolved", "flagged"}:
            status = "unresolved"
        discrepancies.append(
            {
                "field_id": field_id,
                "lane_values": lane_values if isinstance(lane_values, dict) else {},
                "resolved_value": item.get("resolved_value") or item.get("resolvedValue"),
                "status": status,
                "rationale": str(item.get("rationale") or "").strip() or None,
            }
        )

    enrichments: list[dict[str, Any]] = []
    for item in raw.get("enrichments") or []:
        if not isinstance(item, dict):
            continue
        field_id = str(item.get("field_id") or item.get("fieldId") or "").strip()
        value = item.get("value")
        if not field_id or value is None or str(value).strip() == "":
            continue
        enrichments.append(
            {
                "field_id": field_id,
                "value": str(value).strip(),
                "source": str(item.get("source") or "sov_orchestrator").strip(),
                "note": str(item.get("note") or "").strip() or None,
            }
        )

    notes = raw.get("underwriter_notes") or raw.get("underwriterNotes") or []
    if not isinstance(notes, list):
        notes = []
    underwriter_notes = [str(n).strip() for n in notes if str(n).strip()]

    return {
        "statement_of_values": statement_of_values,
        "discrepancies": discrepancies,
        "enrichments": enrichments,
        "underwriter_notes": underwriter_notes,
        "summary": str(raw.get("summary") or "").strip() or None,
    }


def build_pass_through_result(
    trusted: dict[str, Any],
    *,
    summary: str | None = None,
) -> dict[str, Any]:
    """Deterministic SOV when LLM is skipped."""
    statement_of_values: dict[str, dict[str, Any]] = {}
    for field_id, tv in trusted.items():
        status = getattr(tv, "status", None) if not isinstance(tv, dict) else tv.get("status")
        value = getattr(tv, "value", None) if not isinstance(tv, dict) else tv.get("value")
        source = getattr(tv, "source", None) if not isinstance(tv, dict) else tv.get("source")
        confidence = getattr(tv, "confidence", "unknown") if not isinstance(tv, dict) else tv.get("confidence")
        if status == "observed" and value:
            statement_of_values[field_id] = {
                "value": str(value),
                "confidence": confidence or "medium",
                "primary_source": source,
                "supporting_lanes": ["deterministic"],
            }
    return {
        "statement_of_values": statement_of_values,
        "discrepancies": [],
        "enrichments": [],
        "underwriter_notes": [],
        "summary": summary or "Statement of values derived from deterministic source precedence.",
    }
