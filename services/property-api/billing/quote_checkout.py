"""Quote-based checkout pricing (exact amount or credit gap)."""

from __future__ import annotations

from typing import Any, Literal

from billing.config import billing_enabled
from billing.credits import (
    batch_enrich_credits_cost,
    credits_to_usd,
    discovery_credits_cost,
    enrich_credits_cost,
    usd_to_credits,
)
from billing.db import get_balance
from geocode import geocode_address
from planner.batch_quote import build_batch_quote
from planner.quote import build_quote
from registry_loader import resolve_selected_sources
from source_discovery.discover import discovery_receipt

Purpose = Literal["enrich", "discover", "batch_enrich"]
STRIPE_MIN_USD = 0.50


async def _pricing_for_enrich(address: str, selected_sources: list[str]) -> tuple[float, int]:
    geo = await geocode_address(address.strip())
    if not geo:
        raise ValueError(
            "Address could not be geocoded. Use a full street address with city, state, and ZIP."
        )
    addr = geo.get("address") or {}
    country_hint = addr.get("country") or addr.get("country_code")
    resolved = resolve_selected_sources(selected_sources or None)
    quote_data = build_quote(
        address_input=address.strip(),
        selected_sources=resolved,
        display_name=geo.get("display_name"),
        lat=geo["lat"],
        lng=geo["lng"],
        country_hint=country_hint,
    )
    user_price_usd = float(quote_data["totals"]["user_price_usd"])
    needed_credits = enrich_credits_cost(quote_data)
    return user_price_usd, needed_credits


def _pricing_for_discover() -> tuple[float, int]:
    receipt = discovery_receipt()
    user_price_usd = float(receipt.get("user_price_usd") or 0)
    needed_credits = discovery_credits_cost()
    return user_price_usd, needed_credits


async def _pricing_for_batch_enrich(addresses: list[str], selected_sources: list[str]) -> tuple[float, int]:
    batch = await build_batch_quote(addresses=addresses, selected_sources=selected_sources)
    valid = [loc for loc in batch["locations"] if loc.get("status") == "valid"]
    if not valid:
        raise ValueError("No valid locations in schedule.")
    user_price_usd = float(batch["totals"]["user_price_usd"])
    needed_credits = batch_enrich_credits_cost(batch)
    return user_price_usd, needed_credits


async def compute_checkout_pricing(
    *,
    purpose: str,
    address: str,
    selected_sources: list[str],
    anon_id: str,
    addresses: list[str] | None = None,
) -> dict[str, Any]:
    if purpose == "enrich":
        user_price_usd, needed_credits = await _pricing_for_enrich(address, selected_sources)
    elif purpose == "batch_enrich":
        addrs = addresses or ([address] if address else [])
        user_price_usd, needed_credits = await _pricing_for_batch_enrich(addrs, selected_sources)
    elif purpose == "discover":
        user_price_usd, needed_credits = _pricing_for_discover()
    else:
        raise ValueError(f"Unknown purpose: {purpose}")

    balance = await get_balance(anon_id)
    gap_credits = max(0, needed_credits - balance)

    if gap_credits == 0:
        return {
            "sufficient": True,
            "purpose": purpose,
            "user_price_usd": user_price_usd,
            "needed_credits": needed_credits,
            "balance_credits": balance,
            "gap_credits": 0,
            "charge_usd": 0.0,
            "credits_to_add": 0,
            "billing_enabled": billing_enabled(),
        }

    if balance == 0:
        charge_usd = user_price_usd
        credits_to_add = needed_credits
    else:
        credits_to_add = gap_credits
        charge_usd = credits_to_usd(gap_credits)

    if charge_usd < STRIPE_MIN_USD:
        charge_usd = STRIPE_MIN_USD
        credits_to_add = max(credits_to_add, usd_to_credits(STRIPE_MIN_USD))

    return {
        "sufficient": False,
        "purpose": purpose,
        "user_price_usd": user_price_usd,
        "needed_credits": needed_credits,
        "balance_credits": balance,
        "gap_credits": gap_credits,
        "charge_usd": charge_usd,
        "credits_to_add": credits_to_add,
        "billing_enabled": billing_enabled(),
    }
