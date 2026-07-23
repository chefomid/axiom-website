"""Render standardized SOV Markdown digest."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from agents.sov_orchestrator.lanes import load_sov_schema

_AGENT_VERSION = 1
_TEMPLATE_PATH = Path(__file__).resolve().parent / "templates" / "sov_digest.md"


def _esc_table_cell(value: Any) -> str:
    text = str(value or "—").replace("|", "\\|").replace("\n", " ")
    return text.strip() or "—"


def _sov_table(statement_of_values: dict[str, Any]) -> str:
    labels = {f["id"]: f["label"] for f in load_sov_schema().get("fields", [])}
    rows = ["| Field | Value | Source | Confidence |", "| --- | --- | --- | --- |"]
    for field_id, entry in statement_of_values.items():
        rows.append(
            "| "
            + " | ".join(
                [
                    _esc_table_cell(labels.get(field_id, field_id)),
                    _esc_table_cell(entry.get("value")),
                    _esc_table_cell(entry.get("primary_source")),
                    _esc_table_cell(entry.get("confidence")),
                ]
            )
            + " |"
        )
    return "\n".join(rows) if len(rows) > 2 else "_No SOV fields populated._"


def _discrepancies_section(discrepancies: list[dict[str, Any]]) -> str:
    if not discrepancies:
        return "_No discrepancies recorded._"
    lines: list[str] = []
    for d in discrepancies:
        field_id = d.get("field_id")
        status = d.get("status")
        resolved = d.get("resolved_value")
        rationale = d.get("rationale") or ""
        lane_values = d.get("lane_values") or {}
        lane_str = ", ".join(f"{k}={v}" for k, v in lane_values.items() if v is not None)
        lines.append(f"- **{field_id}** ({status}): lanes [{lane_str}] → {resolved or '—'}. {rationale}")
    return "\n".join(lines)


def _enrichments_section(enrichments: list[dict[str, Any]]) -> str:
    if not enrichments:
        return "_None applied._"
    return "\n".join(
        f"- **{e.get('field_id')}**: {e.get('value')} ({e.get('source')}) — {e.get('note') or ''}"
        for e in enrichments
    )


def _lane_section(lanes: dict[str, Any]) -> str:
    parts = []
    if lanes.get("vendor_api"):
        parts.append(f"- **vendor_api:** {len(lanes['vendor_api'])} field(s)")
    online_fields = (lanes.get("online_public") or {}).get("fields") or {}
    if online_fields:
        parts.append(f"- **online_public:** {len(online_fields)} field(s)")
    visual_fields = (lanes.get("visual_ai") or {}).get("fields") or {}
    if visual_fields:
        parts.append(f"- **visual_ai:** {len(visual_fields)} field(s)")
    return "\n".join(parts) if parts else "_Single-lane or no lane data._"


def render_sov_digest(
    *,
    address: str,
    lat: float,
    lng: float,
    result: dict[str, Any],
    lanes: dict[str, Any],
    completeness_pct: int,
) -> str:
    discrepancies = result.get("discrepancies") or []
    unresolved_count = sum(1 for d in discrepancies if d.get("status") != "resolved")

    frontmatter = {
        "schema_version": 1,
        "agent_version": _AGENT_VERSION,
        "address": address,
        "coordinates": [round(lat, 6), round(lng, 6)],
        "completeness_pct": completeness_pct,
        "unresolved_count": unresolved_count,
    }

    body_template = _TEMPLATE_PATH.read_text(encoding="utf-8")
    if body_template.startswith("---"):
        end = body_template.find("---", 3)
        if end != -1:
            body_template = body_template[end + 3 :].lstrip()

    replacements = {
        "{{ address }}": address,
        "{{ lat }}": str(round(lat, 6)),
        "{{ lng }}": str(round(lng, 6)),
        "{{ completeness_pct }}": str(completeness_pct),
        "{{ unresolved_count }}": str(unresolved_count),
        "{{ sov_table }}": _sov_table(result.get("statement_of_values") or {}),
        "{{ discrepancies_section }}": _discrepancies_section(discrepancies),
        "{{ enrichments_section }}": _enrichments_section(result.get("enrichments") or []),
        "{{ lane_section }}": _lane_section(lanes),
        "{{ notes_section }}": "\n".join(f"- {n}" for n in (result.get("underwriter_notes") or []))
        or "_None noted._",
    }
    body = body_template
    for key, val in replacements.items():
        body = body.replace(key, val)

    yaml_block = yaml.safe_dump(frontmatter, sort_keys=False, allow_unicode=True).strip()
    return f"---\n{yaml_block}\n---\n{body}"


def parse_sov_digest_frontmatter(md: str) -> dict[str, Any]:
    if not md.startswith("---"):
        return {}
    end = md.find("---", 3)
    if end == -1:
        return {}
    try:
        parsed = yaml.safe_load(md[3:end])
    except yaml.YAMLError:
        return {}
    return parsed if isinstance(parsed, dict) else {}
