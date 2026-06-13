"""Tests for SOV orchestrator apply step."""

from __future__ import annotations

from agents.sov_orchestrator.apply import apply_orchestrator_result
from engine.models import TrustedValue


def test_apply_resolved_discrepancy_updates_trusted():
    trusted = {
        "stories": TrustedValue(
            field_id="stories",
            value="2",
            display_value="2",
            source="attom",
            confidence="high",
            method="precedence",
            status="observed",
            alternatives=[{"value": "3", "source": "vision_construction"}],
            conflict=True,
        )
    }
    result = {
        "statement_of_values": {
            "stories": {
                "value": "3",
                "confidence": "medium",
                "primary_source": "vision_construction",
            }
        },
        "discrepancies": [
            {
                "field_id": "stories",
                "status": "resolved",
                "resolved_value": "3",
                "rationale": "Three floor bands visible",
            }
        ],
        "enrichments": [],
    }
    adjusted, remaining = apply_orchestrator_result(
        trusted,
        result,
        original_conflicts=[
            {
                "field_id": "stories",
                "alternatives": [{"value": "2", "source": "attom"}, {"value": "3", "source": "vision"}],
            }
        ],
    )
    assert adjusted["stories"].value == "3"
    assert adjusted["stories"].conflict is False
    assert any(c.get("field_id") == "stories" for c in remaining)


def test_unresolved_discrepancy_keeps_conflict():
    trusted = {
        "stories": TrustedValue(
            field_id="stories",
            value="2",
            display_value="2",
            source="attom",
            confidence="high",
            method="precedence",
            status="observed",
            conflict=True,
        )
    }
    result = {
        "statement_of_values": {},
        "discrepancies": [
            {
                "field_id": "stories",
                "status": "unresolved",
                "rationale": "Insufficient evidence",
            }
        ],
        "enrichments": [],
    }
    _, remaining = apply_orchestrator_result(
        trusted,
        result,
        original_conflicts=[{"field_id": "stories", "alternatives": []}],
    )
    assert any(c.get("field_id") == "stories" for c in remaining)
