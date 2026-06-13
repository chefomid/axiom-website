"""Tests for Property Inspector Markdown digest."""

from __future__ import annotations

from agents.property_inspector.digest import parse_digest_frontmatter, render_inspection_digest


def test_render_inspection_digest_has_frontmatter_and_sections():
    md = render_inspection_digest(
        address="123 Main St, Portland OR",
        lat=45.521,
        lng=-122.651,
        vision={
            "summary": "Three-story frame building with horizontal siding.",
            "storiesVisible": 3,
            "facadeMaterial": "siding",
            "roofMaterial": "membrane",
            "roofShape": "flat",
            "constructionTypeEstimate": "frame",
            "structuralClues": ["combustible siding"],
            "floorLevels": [
                {"level": 1, "feature": "ground floor entry", "image": "street_bearing"},
                {"level": 2, "feature": "second floor windows", "image": "street_bearing"},
                {"level": 3, "feature": "third floor windows", "image": "street_bearing"},
            ],
            "limitations": [],
            "confidence": "medium",
        },
        iso_result={"iso_class": "ISO 1", "iso_label": "Frame", "confidence_cap": "medium"},
        selection={
            "selected_image_id": "street_bearing",
            "subject_identified": True,
            "subject_description": "gray siding building",
        },
        agent_trace={
            "phases": [{"name": "orient", "latency_ms": 100, "detail": "ok"}],
            "captures": [{"image_id": "street_bearing", "heading": 142}],
            "selected_view": {"id": "street_bearing", "heading": 142, "pitch": 0},
        },
        imagery_used=["satellite", "street"],
        subject_description="gray siding building",
        satellite_only=False,
    )
    assert md.startswith("---")
    assert "# Property Visual Inspection" in md
    assert "## Executive summary" in md
    assert "## Floor analysis" in md
    assert "Three-story frame building" in md

    fm = parse_digest_frontmatter(md)
    assert fm.get("schema_version") == 1
    assert fm.get("stories_visible") == 3
    assert fm.get("iso_class") == "ISO 1"
