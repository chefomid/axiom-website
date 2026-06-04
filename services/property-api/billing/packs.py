"""Credit pack definitions for Stripe Checkout."""

from __future__ import annotations

from typing import Any

CREDIT_PACKS: list[dict[str, Any]] = [
    {
        "id": "pack_5",
        "label": "$5 starter",
        "price_usd": 5.0,
        "credits": 55,
        "description": "Try AI discovery and a few reports",
    },
    {
        "id": "pack_25",
        "label": "$25 standard",
        "price_usd": 25.0,
        "credits": 300,
        "description": "Best for regular property lookups",
    },
    {
        "id": "pack_100",
        "label": "$100 pro",
        "price_usd": 100.0,
        "credits": 1300,
        "description": "Volume credits with bonus",
    },
]


def get_pack(pack_id: str) -> dict[str, Any] | None:
    for pack in CREDIT_PACKS:
        if pack["id"] == pack_id:
            return pack
    return None
