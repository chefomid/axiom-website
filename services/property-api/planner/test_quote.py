"""Tests for quote pricing: public sources at $0 vendor, platform service fee = breakeven + margin."""

from unittest.mock import patch

from planner.quote import build_line_items, compute_totals


def test_public_sources_have_zero_vendor_line_price():
    items = build_line_items(["hazard_fema", "hazard_usgs", "cope_map"], country_hint="US")
    public = [i for i in items if i["api_cost_usd"] == 0]
    assert public
    assert all(i["user_price_usd"] == 0 for i in public)


@patch("planner.quote._api_key_configured", return_value=True)
def test_licensed_sources_price_vendor_api_with_margin(_mock_keys):
    items = build_line_items(["attom_property"], country_hint="US")
    attom = next(i for i in items if i["source_id"] == "attom_property")
    assert attom["api_cost_usd"] > 0
    assert attom["user_price_usd"] == round(attom["api_cost_usd"] * 2.5, 2)


def test_compute_totals_includes_platform_service_fee():
    items = build_line_items(
        ["hazard_fema", "hazard_usgs", "hazard_nws", "cope_map"],
        country_hint="US",
    )
    totals = compute_totals(items)
    assert totals["breakeven_usd"] > 0
    assert totals["platform_service_fee_usd"] == round(
        totals["breakeven_usd"] + totals["platform_margin_usd"], 2
    )
    assert totals["vendor_charges_usd"] == 0
    assert totals["user_price_usd"] == totals["platform_service_fee_usd"]


@patch("planner.quote._api_key_configured", return_value=True)
def test_compute_totals_adds_vendor_charges_on_top_of_service_fee(_mock_keys):
    items = build_line_items(["attom_property", "hazard_fema"], country_hint="US")
    totals = compute_totals(items)
    assert totals["vendor_charges_usd"] > 0
    assert totals["user_price_usd"] == round(
        totals["platform_service_fee_usd"] + totals["vendor_charges_usd"], 2
    )
