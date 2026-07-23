"""Tests for canonical address standardization used by vendor adapters."""

from __future__ import annotations

from address_std import (
    attom_address_params,
    standardize_address,
    vendor_address,
)
from engine.models import SourceContext


def test_photon_style_portland_label_builds_street_line1():
    label = "1221, Southwest 4th Avenue, Portland, Oregon, 97204, United States"
    geo = {
        "display_name": label,
        "lat": 45.512,
        "lng": -122.678,
        "source": "photon",
        "address": {
            "housenumber": "1221",
            "street": "Southwest 4th Avenue",
            "city": "Portland",
            "state": "Oregon",
            "postcode": "97204",
            "country": "United States",
        },
    }
    std = standardize_address(input_address=label, geo=geo)
    assert std.line1 == "1221 Southwest 4th Avenue"
    assert std.state == "OR"
    assert std.city == "Portland"
    assert std.postal_code == "97204"
    assert std.quality == "complete"
    assert "1221 Southwest 4th Avenue" in std.full
    assert "OR" in std.full

    params = attom_address_params(std)
    assert params["address1"] == "1221 Southwest 4th Avenue"
    assert params["address1"] != "1221"
    assert "Portland" in params["address2"]
    assert "OR" in params["address2"]
    assert "97204" in params["address2"]


def test_census_matched_address_preferred_for_lines():
    input_address = "1221 SW 4th Ave, Portland, OR 97204"
    photon_geo = {
        "display_name": "1221, Southwest 4th Avenue, Portland, Oregon, 97204, United States",
        "lat": 45.5121,
        "lng": -122.6781,
        "source": "photon",
        "address": {
            "housenumber": "1221",
            "street": "Southwest 4th Avenue",
            "city": "Portland",
            "state": "Oregon",
            "postcode": "97204",
        },
    }
    census_geo = {
        "display_name": "1221 SW 4TH AVE, PORTLAND, OR, 97204",
        "lat": 45.5120,
        "lng": -122.6780,
        "source": "us_census",
        "address": {
            "fromAddress": "1221",
            "preDirection": "SW",
            "streetName": "4TH",
            "suffixType": "AVE",
            "city": "PORTLAND",
            "state": "OR",
            "zip": "97204",
        },
    }
    # Pin from Photon, lines from Census.
    merged = {**photon_geo, "address": census_geo["address"]}
    std = standardize_address(input_address=input_address, geo=merged, line_geo=census_geo)
    assert std.line1.upper().startswith("1221")
    assert "4TH" in std.line1.upper() or "4th" in std.line1.lower()
    assert std.state == "OR"
    assert std.postal_code == "97204"
    assert std.quality == "complete"
    assert attom_address_params(std)["address1"] != "1221"


def test_typed_address_complete():
    text = "1221 Southwest 4th Avenue, Portland, OR 97204"
    std = standardize_address(input_address=text, geo={"lat": 45.5, "lng": -122.6, "source": "parsed"})
    assert std.line1 == "1221 Southwest 4th Avenue"
    assert std.city == "Portland"
    assert std.state == "OR"
    assert std.postal_code == "97204"
    assert std.quality == "complete"


def test_house_only_is_unusable():
    std = standardize_address(
        input_address="1221",
        geo={"display_name": "1221", "lat": 0, "lng": 0, "address": {"housenumber": "1221"}, "source": "photon"},
    )
    assert std.quality == "unusable"
    params = attom_address_params(std)
    assert params["address1"] == "1221"


def test_vendor_address_reads_context():
    ctx = SourceContext(
        address="raw",
        geo={"standardized": {"full": "1 Main St, Portland, OR 97204", "line1": "1 Main St"}},
        address_std={"full": "1 Main St, Portland, OR 97204", "line1": "1 Main St", "quality": "complete"},
    )
    assert vendor_address(ctx)["line1"] == "1 Main St"


def test_oregon_full_name_maps_to_abbr_from_display_only():
    label = "1221, Southwest 4th Avenue, Portland, Oregon, 97204, United States"
    std = standardize_address(
        input_address=label,
        geo={"display_name": label, "lat": 45.5, "lng": -122.6, "source": "photon", "address": {}},
    )
    assert std.line1 == "1221 Southwest 4th Avenue"
    assert std.state == "OR"
    assert attom_address_params(std)["address1"] != "1221"


def test_keeps_input_house_number_when_census_mismatches():
    input_address = "1221 SW 4th Ave, Portland, OR 97204"
    census_geo = {
        "display_name": "1201 SW 4TH AVE, PORTLAND, OR, 97204",
        "lat": 45.5120,
        "lng": -122.6780,
        "source": "us_census",
        "address": {
            "fromAddress": "1201",
            "preDirection": "SW",
            "streetName": "4TH",
            "suffixType": "AVE",
            "city": "PORTLAND",
            "state": "OR",
            "zip": "97204",
        },
    }
    photon_geo = {
        "display_name": "1221 Southwest 4th Avenue, Portland, Oregon, 97204, United States",
        "lat": 45.5121,
        "lng": -122.6781,
        "source": "photon",
        "address": {
            "housenumber": "1221",
            "street": "Southwest 4th Avenue",
            "city": "Portland",
            "state": "Oregon",
            "postcode": "97204",
        },
    }
    std = standardize_address(input_address=input_address, geo=photon_geo, line_geo=census_geo)
    assert std.house_number == "1221"
    assert std.line1.startswith("1221")
    assert attom_address_params(std)["address1"].startswith("1221")
