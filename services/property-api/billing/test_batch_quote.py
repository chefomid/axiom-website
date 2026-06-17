"""Tests for batch quote volume pricing."""

from planner.batch_quote import allocate_batch_prices, compute_batch_totals, volume_discount_rate


def _quote(user_price: float, loaded: float) -> dict:
    return {"totals": {"user_price_usd": user_price, "loaded_cost_usd": loaded}}


def test_volume_discount_tiers():
    assert volume_discount_rate(1) == 0.0
    assert volume_discount_rate(3) == 0.05
    assert volume_discount_rate(10) == 0.10
    assert volume_discount_rate(20) == 0.15
    assert volume_discount_rate(60) == 0.20


def test_batch_totals_applies_discount_and_floor():
    quotes = [_quote(10.0, 4.0) for _ in range(4)]
    totals = compute_batch_totals(quotes)
    assert totals["location_count"] == 4
    assert totals["subtotal_user_usd"] == 40.0
    assert totals["volume_discount_rate"] == 0.05
    assert totals["user_price_usd"] == 38.0
    assert totals["effective_per_location_usd"] == 9.5


def test_batch_totals_respects_profitability_floor():
    quotes = [_quote(2.0, 1.5) for _ in range(10)]
    totals = compute_batch_totals(quotes)
    floor = 10 * 1.5 * 1.75
    assert totals["user_price_usd"] >= round(floor, 2)


def test_allocate_prices_sum_to_batch_total():
    quotes = [_quote(0.30, 0.10) for _ in range(2)]
    totals = compute_batch_totals(quotes)
    allocated = allocate_batch_prices(quotes, totals["user_price_usd"])
    assert len(allocated) == 2
    assert round(sum(allocated), 2) == totals["user_price_usd"]


def test_allocate_prices_respects_volume_discount():
    quotes = [_quote(10.0, 4.0) for _ in range(4)]
    totals = compute_batch_totals(quotes)
    allocated = allocate_batch_prices(quotes, totals["user_price_usd"])
    assert round(sum(allocated), 2) == totals["user_price_usd"]
    assert all(price == 9.5 for price in allocated)
