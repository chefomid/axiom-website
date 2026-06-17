"""Tests for Property Inspector orientation."""

from __future__ import annotations

from agents.property_inspector.orient import build_capture_plan, compute_bearing
from agents.property_inspector.tools.streetview import StreetViewMetadata


def test_compute_bearing_north():
    # From slightly south looking north
    bearing = compute_bearing(45.0, -122.0, 45.001, -122.0)
    assert 0 <= bearing <= 30 or bearing >= 330


def test_capture_plan_max_four_street_views():
    meta = StreetViewMetadata(status="OK", lat=45.52, lng=-122.65)
    plan = build_capture_plan(
        property_lat=45.521,
        property_lng=-122.651,
        street_metadata=meta,
    )
    assert len(plan.capture_specs) <= 4
    assert plan.bearing_deg is not None
    ids = {s.image_id for s in plan.capture_specs}
    assert "street_bearing" in ids


def test_capture_plan_no_street_when_unavailable():
    plan = build_capture_plan(
        property_lat=45.521,
        property_lng=-122.651,
        street_metadata=StreetViewMetadata(status="ZERO_RESULTS"),
    )
    assert plan.capture_specs == []


def test_floor_scan_specs_use_selected_heading():
    from agents.property_inspector.orient import build_floor_scan_specs

    specs = build_floor_scan_specs(109)
    assert len(specs) == 3
    assert all(s.heading == 109 for s in specs)
    pitches = {s.pitch for s in specs}
    assert pitches == {-30, -15, 10}
    ids = {s.image_id for s in specs}
    assert "floor_scan_up30" in ids
    assert "floor_scan_up15" in ids
    assert "floor_scan_down10" in ids
