"""Stripe Checkout + webhook handling.

QR phone flow: the desktop QR encodes a hosted Checkout session URL. The desktop
polls that hosted ``session_id`` via GET /billing/checkout-status. The Stripe
webhook (``checkout.session.completed``) is the reliable fulfillment path;
polling syncs the desktop UI and idempotently fulfills if the webhook has not
run yet.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import stripe

from billing.config import frontend_url, stripe_secret_key, stripe_webhook_secret
from billing.db import add_credits, claim_stripe_event, get_balance
from billing.packs import get_pack

logger = logging.getLogger(__name__)

CHECKOUT_STATUS_ROUTE = "/billing/checkout-status"
BILLING_VERIFY_RETRY = "Unable to verify payment right now. Please try again."
BILLING_AUTH_MISCONFIG = "Billing verification is not configured correctly."
BILLING_SESSION_NOT_FOUND = "Checkout session not found."
BILLING_SESSION_INVALID = "Checkout session is not valid."


@dataclass(frozen=True)
class CheckoutStatusError:
    status_code: int
    detail: str


def _safe_prefix(value: str, length: int) -> str:
    cleaned = (value or "").strip()
    return cleaned[:length] if cleaned else ""


def log_checkout_status_failure(session_id: str, anon_id: str, exc: Exception) -> None:
    stripe_code = getattr(exc, "code", None)
    stripe_http_status = getattr(exc, "http_status", None)
    stripe_request_id = getattr(exc, "request_id", None)
    logger.error(
        "checkout-status failed route=%s session_id_prefix=%s anon_id_prefix=%s "
        "exception_type=%s stripe_code=%s stripe_http_status=%s stripe_request_id=%s "
        "exception_message=%s",
        CHECKOUT_STATUS_ROUTE,
        _safe_prefix(session_id, 12),
        _safe_prefix(anon_id, 8),
        type(exc).__name__,
        stripe_code,
        stripe_http_status,
        stripe_request_id,
        str(exc)[:500],
    )


def map_checkout_status_exception(session_id: str, anon_id: str, exc: Exception) -> CheckoutStatusError:
    log_checkout_status_failure(session_id, anon_id, exc)

    if isinstance(exc, stripe.error.AuthenticationError):
        return CheckoutStatusError(503, BILLING_AUTH_MISCONFIG)

    if isinstance(exc, stripe.error.InvalidRequestError):
        message = str(exc)
        code = getattr(exc, "code", None) or ""
        if code == "resource_missing" or "No such checkout.session" in message:
            return CheckoutStatusError(404, BILLING_SESSION_NOT_FOUND)
        return CheckoutStatusError(400, BILLING_SESSION_INVALID)

    if isinstance(exc, stripe.error.APIConnectionError):
        return CheckoutStatusError(503, BILLING_VERIFY_RETRY)

    if isinstance(exc, (stripe.error.APIError, stripe.error.RateLimitError)):
        return CheckoutStatusError(502, BILLING_VERIFY_RETRY)

    return CheckoutStatusError(502, BILLING_VERIFY_RETRY)


def _billing_return_url(
    base: str,
    *,
    billing: str,
    anon_id: str,
    resume: str | None = None,
    include_session_id: bool = False,
) -> str:
    params = [f"billing={billing}", f"anon_id={quote(anon_id.strip(), safe='')}"]
    if resume:
        params.append(f"resume={quote(resume, safe='')}")
    if include_session_id and billing == "success":
        params.append("session_id={CHECKOUT_SESSION_ID}")
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
        params["return_url"] = _billing_return_url(
            base, billing="success", anon_id=aid, resume=resume, include_session_id=True
        )
    else:
        params["success_url"] = _billing_return_url(
            base, billing="success", anon_id=aid, resume=resume, include_session_id=True
        )
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
        "checkout_mode": "embedded" if embedded else "hosted",
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


async def _retrieve_checkout_session(session_id: str, *, attempts: int = 3) -> Any:
    """Retrieve Stripe checkout session without blocking the event loop."""
    sid = session_id.strip()

    def _retrieve() -> Any:
        stripe.api_key = stripe_secret_key()
        return stripe.checkout.Session.retrieve(sid)

    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return await asyncio.to_thread(_retrieve)
        except (stripe.error.APIConnectionError, stripe.error.APIError, stripe.error.RateLimitError) as exc:
            last_exc = exc
            if attempt + 1 < attempts:
                await asyncio.sleep(0.25 * (attempt + 1))
                continue
            raise
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("checkout session retrieve failed")


async def get_embed_checkout_credentials(session_id: str, anon_id: str) -> dict[str, Any]:
    session = await _retrieve_checkout_session(session_id)
    metadata = _session_metadata(session)
    if (metadata.get("anon_id") or "").strip() != anon_id.strip():
        raise ValueError("Session does not belong to this user")
    if _session_field(session, "ui_mode") != "embedded":
        raise ValueError("Session is not an embedded checkout")

    client_secret = _session_field(session, "client_secret")
    if not client_secret:
        raise ValueError("Checkout session is missing a client secret")

    amount_total = _session_field(session, "amount_total")
    charge_usd = round(int(amount_total or 0) / 100, 2) if amount_total else None

    return {
        "client_secret": client_secret,
        "session_id": _session_field(session, "id") or session_id.strip(),
        "status": _session_field(session, "status") or "open",
        "charge_usd": charge_usd,
    }


def _session_field(session: Any, key: str, default: Any = None) -> Any:
    """Read a field from a Stripe Session (StripeObject has no .get())."""
    if callable(getattr(session, "get", None)):
        val = session.get(key, default)
        return default if val is None and default is not None else val
    try:
        val = session[key]
        return default if val is None and default is not None else val
    except KeyError:
        return default


def _session_metadata(session: Any) -> dict[str, str]:
    raw = _session_field(session, "metadata")
    if not raw:
        return {}
    if isinstance(raw, dict):
        return {str(k): str(v) for k, v in raw.items()}
    to_dict = getattr(raw, "to_dict", None)
    if callable(to_dict):
        return {str(k): str(v) for k, v in to_dict().items()}
    return {str(k): str(v) for k, v in raw.items()}


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
    session_id = _session_field(session, "id")

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
    session = await _retrieve_checkout_session(session_id)
    metadata = _session_metadata(session)
    if (metadata.get("anon_id") or "").strip() != anon_id.strip():
        raise ValueError("Session does not belong to this user")

    payment_status = _session_field(session, "payment_status") or "unpaid"
    session_status = _session_field(session, "status") or "open"
    is_paid = payment_status == "paid" or session_status == "complete"
    credits_added = 0
    balance = await get_balance(anon_id)

    if is_paid:
        result = await fulfill_checkout_session(session)
        credits_added = int(result.get("credits_added") or 0)
        balance = int(result.get("balance_credits") or balance)

    status = "paid" if is_paid else "open"
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
