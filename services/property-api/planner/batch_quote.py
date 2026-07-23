"""Batch quote aggregation with volume pricing."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from geocode import geocode_address
from planner.quote import _round_usd, build_quote, warnings_for_selection
from registry_loader import resolve_selected_sources

REGISTRY_DIR = Path(__file__).resolve().parent.parent / "registry"
_BATCH_PRICING: dict[str, Any] | None = None


def _load_batch_pricing() -> dict[str, Any]:
    global _BATCH_PRICING
    if _BATCH_PRICING is None:
        with open(REGISTRY_DIR / "batch_pricing.json", encoding="utf-8") as f:
            _BATCH_PRICING = json.load(f)
    return _BATCH_PRICING


def get_max_batch_locations() -> int:
    return int(_load_batch_pricing().get("max_locations", 100))


def volume_discount_rate(location_count: int) -> float:
    if location_count <= 0:
        return 0.0
    tiers = _load_batch_pricing().get("volume_discount_tiers") or []
    for tier in sorted(tiers, key=lambda t: t.get("min_count", 0), reverse=True):
        if location_count >= int(tier.get("min_count", 0)):
            return float(tier.get("rate", 0))
    return 0.0


def allocate_batch_prices(valid_quotes: list[dict[str, Any]], batch_user_price: float) -> list[float]:
    """Split final batch price across locations so line items sum to the batch total."""
    n = len(valid_quotes)
    if n == 0:
        return []
    if n == 1:
        return [_round_usd(batch_user_price)]

    weights = [max(float(q["totals"]["user_price_usd"]), 0.0) for q in valid_quotes]
    weight_sum = sum(weights)
    if weight_sum <= 0:
        even = _round_usd(batch_user_price / n)
        allocated = [even] * (n - 1)
        allocated.append(_round_usd(batch_user_price - even * (n - 1)))
        return allocated

    allocated: list[float] = []
    running = 0.0
    for index, weight in enumerate(weights):
        if index == n - 1:
            allocated.append(_round_usd(batch_user_price - running))
            continue
        share = _round_usd(batch_user_price * (weight / weight_sum))
        allocated.append(share)
        running += share
    return allocated


def compute_batch_totals(valid_quotes: list[dict[str, Any]]) -> dict[str, Any]:
    cfg = _load_batch_pricing()
    min_bulk_margin = float(cfg.get("min_bulk_margin_multiplier", 1.75))

    subtotal_user = sum(float(q["totals"]["user_price_usd"]) for q in valid_quotes)
    subtotal_loaded = sum(float(q["totals"]["loaded_cost_usd"]) for q in valid_quotes)
    n = len(valid_quotes)

    discount_rate = volume_discount_rate(n)
    discounted = subtotal_user * (1 - discount_rate)
    floor = subtotal_loaded * min_bulk_margin
    batch_user_price = _round_usd(max(discounted, floor))
    volume_savings = _round_usd(max(0.0, subtotal_user - batch_user_price))
    effective = _round_usd(batch_user_price / n) if n else 0.0

    return {
        "location_count": n,
        "subtotal_user_usd": _round_usd(subtotal_user),
        "subtotal_loaded_usd": _round_usd(subtotal_loaded),
        "volume_discount_rate": discount_rate,
        "volume_savings_usd": volume_savings,
        "user_price_usd": batch_user_price,
        "effective_per_location_usd": effective,
        "min_bulk_margin_multiplier": min_bulk_margin,
    }


async def build_batch_quote(
    *,
    addresses: list[str],
    selected_sources: list[str] | None,
) -> dict[str, Any]:
    max_n = get_max_batch_locations()
    if len(addresses) > max_n:
        raise ValueError(f"Maximum {max_n} locations per schedule.")

    resolved = resolve_selected_sources(selected_sources)
    batch_id = f"BQ-{uuid.uuid4().hex[:8].upper()}"
    locations: list[dict[str, Any]] = []
    valid_quotes: list[dict[str, Any]] = []

    for index, raw in enumerate(addresses):
        address_input = raw.strip()
        if not address_input:
            continue
        row_index = index + 1
        try:
            geo = await geocode_address(address_input)
        except Exception as exc:
            locations.append(
                {
                    "row_index": row_index,
                    "address_input": address_input,
                    "status": "invalid",
                    "error": f"Geocoding error: {exc}",
                }
            )
            continue

        if not geo:
            locations.append(
                {
                    "row_index": row_index,
                    "address_input": address_input,
                    "status": "invalid",
                    "error": "Address could not be geocoded.",
                }
            )
            continue

        addr = geo.get("address") or {}
        country_hint = addr.get("country") or addr.get("country_code")
        address_std = geo.get("standardized") if isinstance(geo.get("standardized"), dict) else None
        quote_data = build_quote(
            address_input=address_input,
            selected_sources=resolved,
            display_name=geo.get("display_name"),
            lat=geo["lat"],
            lng=geo["lng"],
            country_hint=country_hint,
            address_std=address_std,
        )
        valid_quotes.append(quote_data)
        locations.append(
            {
                "row_index": row_index,
                "address_input": address_input,
                "display_name": geo.get("display_name"),
                "address_std": address_std,
                "lat": geo["lat"],
                "lng": geo["lng"],
                "status": "valid",
                "quote": quote_data,
            }
        )

    totals = compute_batch_totals(valid_quotes)
    allocated_prices = allocate_batch_prices(valid_quotes, totals["user_price_usd"])
    valid_index = 0
    for loc in locations:
        if loc.get("status") != "valid":
            continue
        price = allocated_prices[valid_index]
        loc["allocated_price_usd"] = price
        valid_index += 1

    return {
        "batch_id": batch_id,
        "selected_sources": resolved,
        "locations": locations,
        "totals": totals,
        "warnings": warnings_for_selection(resolved),
    }
