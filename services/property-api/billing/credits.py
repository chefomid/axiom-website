"""Convert USD receipt totals to credit costs."""

from __future__ import annotations

import math
from typing import Any

from source_discovery.discover import discovery_receipt

# 1 credit ≈ $0.10 of user-facing price (10 credits per dollar, rounded up).
CREDITS_PER_USD = 10


def usd_to_credits(user_price_usd: float) -> int:
    if user_price_usd <= 0:
        return 0
    return max(1, math.ceil(user_price_usd * CREDITS_PER_USD))


def credits_to_usd(credits: int) -> float:
    if credits <= 0:
        return 0.0
    return round(credits / CREDITS_PER_USD, 2)


def discovery_credits_cost() -> int:
    receipt = discovery_receipt()
    return usd_to_credits(float(receipt.get("user_price_usd") or 0))


def enrich_credits_cost(quote_data: dict[str, Any]) -> int:
    totals = quote_data.get("totals") or {}
    return usd_to_credits(float(totals.get("user_price_usd") or 0))


def batch_enrich_credits_cost(batch_quote_data: dict[str, Any]) -> int:
    totals = batch_quote_data.get("totals") or {}
    return usd_to_credits(float(totals.get("user_price_usd") or 0))
