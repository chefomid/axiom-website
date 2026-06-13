"""Tests for SOV Markdown digest rendering."""

from __future__ import annotations

from agents.sov_orchestrator.digest import parse_sov_digest_frontmatter, render_sov_digest


def test_render_sov_digest_has_frontmatter_and_sections():
    md = render_sov_digest(
        address="123 Main St",
        lat=45.52,
        lng=-122.65,
        result={
            "statement_of_values": {
                "stories": {
                    "value": "3",
                    "confidence": "medium",
                    "primary_source": "vision_construction",
                }
            },
            "discrepancies": [],
            "enrichments": [],
            "underwriter_notes": ["Verify with assessor"],
            "summary": "SOV ready with visual story count.",
        },
        lanes={"vendor_api": {}, "online_public": {"fields": {}}, "visual_ai": {"fields": {"stories": []}}},
        completeness_pct=75,
    )
    assert md.startswith("---")
    assert "# Statement of Values" in md
    assert "## Schedule of values" in md
    fm = parse_sov_digest_frontmatter(md)
    assert fm.get("completeness_pct") == 75
