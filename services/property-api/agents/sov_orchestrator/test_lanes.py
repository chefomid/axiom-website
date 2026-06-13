"""Tests for SOV orchestrator lane bundling."""

from __future__ import annotations

from agents.sov_orchestrator.lanes import build_evidence_lanes, build_vendor_lane, lane_disagreement_on_field
from engine.models import Observation, TrustedValue


def test_build_vendor_lane_groups_observations():
    obs = [
        Observation("stories", "2", "2", "attom", "high", "attom_property"),
        Observation("year_built", "1985", "1985", "attom", "high", "attom_property"),
    ]
    lane = build_vendor_lane(obs)
    assert "stories" in lane
    assert lane["stories"][0]["value"] == "2"


def test_lane_disagreement_detects_mismatch():
    lanes = {
        "vendor_api": {"stories": [{"value": "2"}]},
        "online_public": {"fields": {}},
        "visual_ai": {"fields": {"stories": [{"value": "3"}]}},
    }
    assert lane_disagreement_on_field(lanes, "stories") is True


def test_build_evidence_lanes_counts_active_lanes():
    obs = [
        Observation("stories", "2", "2", "attom", "high", "attom_property"),
    ]
    trusted = {
        "stories": TrustedValue(
            "stories", "2", "2", "attom", "high", "precedence", "observed"
        )
    }
    lanes = build_evidence_lanes(
        obs,
        vision_analysis={"stories_visible": 3, "confidence": "medium"},
        web_research_run=None,
        crawl_excerpt=None,
        trusted=trusted,
        conflicts=[],
    )
    assert lanes["lanes_with_data"] >= 2
