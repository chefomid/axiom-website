"""Stripe Checkout + webhook handling."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import stripe

from billing.config import frontend_url, stripe_secret_key, stripe_webhook_secret
from billing.db import add_credits, claim_stripe_event, get_balance
from billing.packs import get_pack


def _billing_return_url(base: str, *, billing: str, anon_id: str, resume: str | None = None) -> str:
    params = [f"billing={billing}", f"anon_id={quote(anon_id.strip(), safe='')}"]
    if resume:
        params.append(f"resume={quote(resume, safe='')}")
    return f"{base}/property-intelligence?{'&'.join(params)}"


def _create_stripe_session(
    *,
    line_items: list[dict[str, Any]],
    metadata: dict[str, str],
    anon_id: str,
    embedded: bool,
    resume: str | None = None,
) -> stripe.checkout.Session:
    stripe.api_key = stripe_secret_key()
    base = frontend_url()
    aid = anon_id.strip()

    params: dict[str, Any] = {
        "mode": "payment",
        "line_items": line_items,
        "metadata": metadata,
    }

    if embedded:
        params["ui_mode"] = "embedded_page"
        params["return_url"] = _billing_return_url(base, billing="success", anon_id=aid, resume=resume)
    else:
        params["success_url"] = _billing_return_url(base, billing="success", anon_id=aid, resume=resume)
        params["cancel_url"] = _billing_return_url(base, billing="cancel", anon_id=aid, resume=resume)

    return stripe.checkout.Session.create(**params)


def _phone_pay_url(session_id: str, anon_id: str) -> str:
    base = frontend_url()
    return (
        f"{base}/property-intelligence/pay"
        f"?session_id={quote(session_id.strip(), safe='')}"
        f"&anon_id={quote(anon_id.strip(), safe='')}"
    )


def _session_response(
    session: stripe.checkout.Session,
    *,
    embedded: bool,
    charge_usd: float,
    credits_to_add: int,
    anon_id: str = "",
) -> dict[str, str | float | int | None]:
    result: dict[str, str | float | int | None] = {
        "session_id": session.id,
        "charge_usd": charge_usd,
        "credits_to_add": credits_to_add,
        "url": None,
        "client_secret": None,
        "phone_pay_url": None,
    }
    if embedded:
        client_secret = session.client_secret
        if not client_secret:
            raise RuntimeError("Stripe did not return a client secret")
        result["client_secret"] = client_secret
        if anon_id.strip():
            result["phone_pay_url"] = _phone_pay_url(session.id, anon_id)
    else:
        url = session.url
        if not url:
            raise RuntimeError("Stripe did not return a checkout URL")
        result["url"] = url
    return result


def create_checkout_session(*, anon_id: str, pack_id: str, embedded: bool = False) -> dict[str, str | float | int | None]:
    pack = get_pack(pack_id)
    if not pack:
        raise ValueError(f"Unknown pack: {pack_id}")

    session = _create_stripe_session(
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
        metadata={
            "anon_id": anon_id.strip(),
            "pack_id": pack_id,
            "credits": str(pack["credits"]),
        },
        anon_id=anon_id,
        embedded=embedded,
    )
    return _session_response(
        session,
        embedded=embedded,
        charge_usd=pack["price_usd"],
        credits_to_add=pack["credits"],
        anon_id=anon_id,
    )


def create_quote_checkout_session(
    *,
    anon_id: str,
    charge_usd: float,
    credits_to_add: int,
    purpose: str,
    description: str,
    embedded: bool = False,
) -> dict[str, str | float | int | None]:
    if charge_usd <= 0 or credits_to_add <= 0:
        raise ValueError("charge_usd and credits_to_add must be positive")

    product_name = (
        "AXIOM Property Intelligence Report"
        if purpose == "enrich"
        else "AXIOM Schedule Analysis"
        if purpose == "batch_enrich"
        else "AXIOM AI URL Discovery"
    )

    session = _create_stripe_session(
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": int(round(charge_usd * 100)),
                    "product_data": {
                        "name": product_name,
                        "description": description[:500],
                    },
                },
                "quantity": 1,
            }
        ],
        metadata={
            "anon_id": anon_id.strip(),
            "credits": str(credits_to_add),
            "checkout_type": "quote",
            "purpose": purpose,
        },
        anon_id=anon_id,
        embedded=embedded,
        resume=purpose,
    )
    return _session_response(
        session,
        embedded=embedded,
        charge_usd=charge_usd,
        credits_to_add=credits_to_add,
        anon_id=anon_id,
    )


async def get_embed_checkout_credentials(session_id: str, anon_id: str) -> dict[str, Any]:
    stripe.api_key = stripe_secret_key()
    session = stripe.checkout.Session.retrieve(session_id.strip())
    metadata = _session_metadata(session)
    if (metadata.get("anon_id") or "").strip() != anon_id.strip():
        raise ValueError("Session does not belong to this user")
    if session.get("ui_mode") != "embedded":
        raise ValueError("Session is not an embedded checkout")

    client_secret = session.get("client_secret")
    if not client_secret:
        raise ValueError("Checkout session is missing a client secret")

    amount_total = session.get("amount_total")
    charge_usd = round(int(amount_total or 0) / 100, 2) if amount_total else None

    return {
        "client_secret": client_secret,
        "session_id": session.get("id") or session_id.strip(),
        "status": session.get("status") or "open",
        "charge_usd": charge_usd,
    }


def _session_metadata(session: Any) -> dict[str, str]:
    raw = session.get("metadata") if hasattr(session, "get") else getattr(session, "metadata", None)
    return dict(raw or {})


def _credits_from_session_metadata(metadata: dict[str, str]) -> int:
    pack_id = metadata.get("pack_id") or ""
    credits_raw = metadata.get("credits")
    pack = get_pack(pack_id) if pack_id else None
    if credits_raw:
        return int(credits_raw)
    return int(pack["credits"]) if pack else 0


def _fulfill_reason(metadata: dict[str, str]) -> str:
    pack_id = metadata.get("pack_id") or ""
    checkout_type = metadata.get("checkout_type") or ""
    purpose = metadata.get("purpose") or ""
    if pack_id:
        return f"stripe_checkout:{pack_id}"
    if checkout_type == "quote" and purpose:
        return f"stripe_checkout:quote:{purpose}"
    return "stripe_checkout:unknown"


async def fulfill_checkout_session(session: Any) -> dict[str, Any]:
    """Credit wallet for a paid checkout session (idempotent via session id reference)."""
    metadata = _session_metadata(session)
    anon_id = (metadata.get("anon_id") or "").strip()
    credits = _credits_from_session_metadata(metadata)
    session_id = session.get("id") if hasattr(session, "get") else getattr(session, "id", None)

    if not anon_id or credits <= 0:
        return {"credits_added": 0, "anon_id": anon_id, "balance_credits": await get_balance(anon_id)}

    balance = await add_credits(
        anon_id,
        credits,
        reason=_fulfill_reason(metadata),
        reference_id=session_id,
    )
    return {"credits_added": credits, "anon_id": anon_id, "balance_credits": balance}


async def get_checkout_status(session_id: str, anon_id: str) -> dict[str, Any]:
    stripe.api_key = stripe_secret_key()
    session = stripe.checkout.Session.retrieve(session_id.strip())
    metadata = _session_metadata(session)
    if (metadata.get("anon_id") or "").strip() != anon_id.strip():
        raise ValueError("Session does not belong to this user")

    payment_status = session.get("payment_status") or "unpaid"
    credits_added = 0
    balance = await get_balance(anon_id)

    if payment_status == "paid":
        result = await fulfill_checkout_session(session)
        credits_added = int(result.get("credits_added") or 0)
        balance = int(result.get("balance_credits") or balance)

    status = "paid" if payment_status == "paid" else "open"
    return {
        "status": status,
        "balance_credits": balance,
        "credits_added": credits_added,
    }


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
        result = await fulfill_checkout_session(session)
        return {
            "ok": True,
            "credits_added": result.get("credits_added", 0),
            "anon_id": result.get("anon_id", ""),
        }

    return {"ok": True, "ignored": event.type}
