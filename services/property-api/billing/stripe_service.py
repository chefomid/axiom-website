"""Stripe Checkout + webhook handling."""

from __future__ import annotations

from typing import Any

import stripe

from billing.config import frontend_url, stripe_secret_key, stripe_webhook_secret
from billing.db import add_credits, claim_stripe_event
from billing.packs import get_pack


def create_checkout_session(*, anon_id: str, pack_id: str) -> dict[str, str]:
    pack = get_pack(pack_id)
    if not pack:
        raise ValueError(f"Unknown pack: {pack_id}")

    stripe.api_key = stripe_secret_key()
    base = frontend_url()
    success = f"{base}/property-intelligence?billing=success"
    cancel = f"{base}/property-intelligence?billing=cancel"

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": int(round(pack["price_usd"] * 100)),
                    "product_data": {
                        "name": f"AXIOM Property Intelligence — {pack['label']}",
                        "description": f"{pack['credits']} credits — {pack.get('description', '')}",
                    },
                },
                "quantity": 1,
            }
        ],
        success_url=success,
        cancel_url=cancel,
        metadata={
            "anon_id": anon_id.strip(),
            "pack_id": pack_id,
            "credits": str(pack["credits"]),
        },
    )
    url = session.url
    if not url:
        raise RuntimeError("Stripe did not return a checkout URL")
    return {"url": url, "session_id": session.id}


async def handle_webhook_payload(payload: bytes, sig_header: str | None) -> dict[str, Any]:
    secret = stripe_webhook_secret()
    if not secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header or "", secret)
    except stripe.error.SignatureVerificationError as e:
        raise ValueError(f"Invalid signature: {e}") from e

    if not await claim_stripe_event(event.id):
        return {"ok": True, "duplicate": True}

    if event.type == "checkout.session.completed":
        session = event.data.object
        metadata = session.get("metadata") or {}
        anon_id = (metadata.get("anon_id") or "").strip()
        pack_id = metadata.get("pack_id") or ""
        credits_raw = metadata.get("credits")
        pack = get_pack(pack_id) if pack_id else None
        credits = int(credits_raw) if credits_raw else (pack["credits"] if pack else 0)
        if anon_id and credits > 0:
            await add_credits(
                anon_id,
                credits,
                reason=f"stripe_checkout:{pack_id}",
                reference_id=session.get("id"),
            )
        return {"ok": True, "credits_added": credits, "anon_id": anon_id}

    return {"ok": True, "ignored": event.type}
