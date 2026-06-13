"""Render standardized Property Inspector Markdown digest."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

_AGENT_VERSION = 1
_TEMPLATE_PATH = Path(__file__).resolve().parent / "templates" / "inspection_digest.md"


def _esc_table_cell(value: Any) -> str:
    text = str(value or "—").replace("|", "\\|").replace("\n", " ")
    return text.strip() or "—"


def _floor_table(floor_levels: list[dict[str, Any]], selected_id: str) -> str:
    if not floor_levels:
        return "_No distinct floor bands identified._"
    rows = ["| Level | Visible feature | Source view |", "| --- | --- | --- |"]
    for item in floor_levels:
        rows.append(
            "| "
            + " | ".join(
                [
                    _esc_table_cell(item.get("level")),
                    _esc_table_cell(item.get("feature")),
                    _esc_table_cell(item.get("image") or selected_id),
                ]
            )
            + " |"
        )
    return "\n".join(rows)


def _bullets(items: list[str]) -> str:
    if not items:
        return "_None noted._"
    return "\n".join(f"- {item}" for item in items)


def _trace_section(agent_trace: dict[str, Any]) -> str:
    lines: list[str] = []
    phases = agent_trace.get("phases") or []
    for phase in phases:
        name = phase.get("name") or "phase"
        ms = phase.get("latency_ms")
        detail = phase.get("detail") or ""
        suffix = f" ({ms} ms)" if ms is not None else ""
        lines.append(f"- **{name}**{suffix}: {detail}")
    captures = agent_trace.get("captures") or []
    if captures:
        cap_lines = ", ".join(
            f"{c.get('image_id')} @ {c.get('heading')}°" for c in captures if c.get("image_id")
        )
        lines.append(f"- **Captures:** {cap_lines}")
    if agent_trace.get("selected_model"):
        lines.append(f"- **Analysis model:** {agent_trace.get('selected_model')}")
    if agent_trace.get("select_model"):
        lines.append(f"- **Selection model:** {agent_trace.get('select_model')}")
    return "\n".join(lines) if lines else "_No trace recorded._"


def render_inspection_digest(
    *,
    address: str,
    lat: float,
    lng: float,
    vision: dict[str, Any],
    iso_result: dict[str, Any],
    selection: dict[str, Any],
    agent_trace: dict[str, Any],
    imagery_used: list[str],
    subject_description: str | None,
    satellite_only: bool,
) -> str:
    """Build YAML-frontmatter Markdown digest from structured agent outputs."""
    selected_id = selection.get("selected_image_id") or "unknown"
    selected_view = agent_trace.get("selected_view") or {}
    floor_levels = vision.get("floorLevels") or []

    construction_lines: list[str] = []
    if vision.get("facadeMaterial"):
        construction_lines.append(f"- **Facade:** {vision['facadeMaterial']}")
    if vision.get("roofMaterial"):
        construction_lines.append(f"- **Roof material:** {vision['roofMaterial']}")
    if vision.get("roofShape"):
        construction_lines.append(f"- **Roof shape:** {vision['roofShape']}")
    if vision.get("constructionTypeEstimate"):
        construction_lines.append(f"- **Construction estimate:** {vision['constructionTypeEstimate']}")
    clues = vision.get("structuralClues") or []
    if clues:
        construction_lines.append("- **Structural clues:** " + "; ".join(clues))
    if iso_result.get("iso_class"):
        construction_lines.append(
            f"- **ISO class:** {iso_result.get('iso_class')} — {iso_result.get('iso_label')}"
        )

    limitations = list(vision.get("limitations") or [])
    limitations.extend(iso_result.get("limitations") or [])
    if satellite_only:
        limitations.insert(0, "Street View unavailable — satellite context only")

    subject_section = subject_description or "_Subject building not confirmed in Street View._"
    if selection.get("subject_identified") is False:
        subject_section = "_Could not confirm subject building in any Street View capture._"

    frontmatter = {
        "schema_version": 1,
        "agent_version": _AGENT_VERSION,
        "address": address,
        "coordinates": [round(lat, 6), round(lng, 6)],
        "stories_visible": vision.get("storiesVisible"),
        "iso_class": iso_result.get("iso_class"),
        "confidence": iso_result.get("confidence_cap") or vision.get("confidence") or "low",
        "selected_view": {
            "id": selected_id,
            "heading": selected_view.get("heading"),
            "pitch": selected_view.get("pitch", 0),
        },
        "imagery": imagery_used,
    }

    body_template = _TEMPLATE_PATH.read_text(encoding="utf-8")
    # Strip template frontmatter — we generate our own
    if body_template.startswith("---"):
        end = body_template.find("---", 3)
        if end != -1:
            body_template = body_template[end + 3 :].lstrip()

    replacements = {
        "{{ address }}": address,
        "{{ lat }}": str(round(lat, 6)),
        "{{ lng }}": str(round(lng, 6)),
        "{{ stories_visible }}": str(vision.get("storiesVisible") if vision.get("storiesVisible") is not None else "null"),
        "{{ iso_class }}": iso_result.get("iso_class") or "",
        "{{ confidence }}": frontmatter["confidence"],
        "{{ selected_view_id }}": selected_id,
        "{{ selected_heading }}": str(selected_view.get("heading") if selected_view.get("heading") is not None else "null"),
        "{{ selected_pitch }}": str(selected_view.get("pitch", 0)),
        "{{ imagery_json }}": json.dumps(imagery_used),
        "{{ summary }}": vision.get("summary") or "_No summary available._",
        "{{ subject_section }}": subject_section,
        "{{ floor_table }}": _floor_table(floor_levels, selected_id),
        "{{ construction_section }}": "\n".join(construction_lines) if construction_lines else "_No construction cues identified._",
        "{{ limitations_section }}": _bullets(limitations),
        "{{ trace_section }}": _trace_section(agent_trace),
    }
    body = body_template
    for key, val in replacements.items():
        body = body.replace(key, val)

    yaml_block = yaml.safe_dump(frontmatter, sort_keys=False, allow_unicode=True).strip()
    return f"---\n{yaml_block}\n---\n{body}"


def parse_digest_frontmatter(md: str) -> dict[str, Any]:
    """Extract YAML frontmatter from inspection digest."""
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
