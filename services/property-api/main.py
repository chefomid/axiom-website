"""
Property Intelligence API — à la carte sources, quoting, and enrichment.

Run: uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import re
import smtplib
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from pathlib import Path
from typing import Any

from billing.config import billing_enabled, billing_status, stripe_publishable_key
from billing.credits import batch_enrich_credits_cost, discovery_credits_cost, enrich_credits_cost
from billing import db as billing_db
from billing.gate import require_and_spend
from billing.packs import CREDIT_PACKS
from billing.stripe_service import (
    create_checkout_session,
    create_quote_checkout_session,
    get_checkout_payment_summary,
    get_checkout_status,
    get_embed_checkout_credentials,
    handle_webhook_payload,
    map_checkout_status_exception,
    refund_checkout_session,
)
from billing.quote_checkout import compute_checkout_pricing
from env_loader import env_status_payload, load_project_env
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, EmailStr, Field, HttpUrl

from geocode import geocode_address, proxy_census_coordinates, proxy_census_onelineaddress, search_addresses
from merger.cope import build_cope_snapshot_from_trusted
from merger.trust import collect_observations_from_results, resolve_all
from planner.quote import _api_key_configured, build_quote, warnings_for_selection
from planner.batch_quote import build_batch_quote
from engine.executor import merge_source_urls
from planner.runner import run_report
from source_discovery.discover import discover_source_urls
from source_discovery.resolve import auto_resolve_crawl_urls
from source_discovery.cache import get_discovery
from registry_loader import (
    default_selected_ids,
    filter_configured_source_ids,
    get_categories,
    get_infra_breakeven_usd,
    get_margin_multiplier,
    get_platform_margin_usd,
    get_presets,
    get_source_by_id,
    get_sources,
    get_vendors,
    resolve_selected_sources_for_request,
)
from public_messages import public_run_message
from reports.email_confirmation import (
    is_email_configured,
    property_label_from_payload,
    send_confirmation_email_async,
)
from report_html import render_report_html
from report_pdf import (
    check_playwright_ready,
    create_session,
    get_session,
    pdf_response,
    pdf_response_for_document,
)
from rate_limit import limiter, rate_limit_handler
from slowapi.errors import RateLimitExceeded

load_project_env()

logger = logging.getLogger(__name__)

BILLING_VERIFY_ERROR = "Unable to verify payment right now. Please try again."


def _billing_stripe_http_exception(exc: Exception) -> HTTPException:
    logger.exception("Billing Stripe error: %s", exc)
    return HTTPException(status_code=502, detail=BILLING_VERIFY_ERROR)


def _new_confirmation_id(purpose: str) -> str:
    prefix = "BX" if purpose == "batch_enrich" else "AX"
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await billing_db.init_db()
    except Exception as exc:
        print(f"Billing database init failed: {exc}")
    from billing.config import stripe_webhook_secret

    if billing_enabled() and not stripe_webhook_secret():
        print(
            "WARNING: STRIPE_WEBHOOK_SECRET is not set — webhook fulfillment disabled. "
            "Desktop QR checkout relies on GET /billing/checkout-status polling; "
            "configure checkout.session.completed webhooks in production."
        )
    yield
    await billing_db.close_db()


app = FastAPI(title="AXIOM Property Intelligence API", version="0.4.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://www.axiompropertycasualty.com",
    "https://axiompropertycasualty.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PropertyField(BaseModel):
    key: str
    value: str | None
    source: str
    confidence: str


class DiscoverSourceUrlsRequest(BaseModel):
    address: str = Field(..., min_length=3, max_length=500)
    selected_sources: list[str] = Field(default_factory=list)
    anon_id: str | None = Field(default=None, max_length=128)


class DiscoverSourceUrlsResponse(BaseModel):
    urls: dict[str, dict[str, Any]]
    discover_available: bool
    message: str | None = None
    warnings: list[str] = Field(default_factory=list)
    receipt: dict[str, Any]
    cached: bool = False


class CheckoutRequest(BaseModel):
    anon_id: str = Field(..., min_length=8, max_length=128)
    pack_id: str = Field(..., min_length=3, max_length=64)
    embedded: bool = False


class CheckoutResponse(BaseModel):
    url: str | None = None
    client_secret: str | None = None
    session_id: str
    checkout_mode: str | None = None
    charge_usd: float | None = None
    credits_to_add: int | None = None
    phone_pay_url: str | None = None


class CheckoutQuoteResponse(BaseModel):
    url: str | None = None
    client_secret: str | None = None
    session_id: str
    checkout_mode: str | None = None
    charge_usd: float
    credits_to_add: int
    phone_pay_url: str | None = None
    confirmation_id: str | None = None


class CheckoutPreviewResponse(BaseModel):
    sufficient: bool
    purpose: str
    user_price_usd: float
    needed_credits: int
    balance_credits: int
    gap_credits: int
    charge_usd: float
    credits_to_add: int
    billing_enabled: bool


class CheckoutQuoteRequest(BaseModel):
    anon_id: str = Field(..., min_length=8, max_length=128)
    purpose: str = Field(..., pattern="^(enrich|discover|batch_enrich)$")
    address: str = Field(default="", max_length=500)
    addresses: list[str] = Field(default_factory=list)
    selected_sources: list[str] = Field(default_factory=list)
    source_urls: dict[str, str] = Field(default_factory=dict)
    confirmed_price_usd: float | None = None
    embedded: bool = False


class BatchCheckoutPreviewRequest(BaseModel):
    anon_id: str = Field(..., min_length=8, max_length=128)
    addresses: list[str] = Field(..., min_length=1, max_length=100)
    selected_sources: list[str] = Field(default_factory=list)


class BalanceResponse(BaseModel):
    anon_id: str
    balance_credits: int
    billing_enabled: bool


class CheckoutStatusResponse(BaseModel):
    status: str
    balance_credits: int
    credits_added: int
    confirmation_id: str | None = None


class ReportConfirmationResponse(BaseModel):
    confirmation_id: str
    status: str
    record: dict[str, Any] | None = None
    message: str | None = None


class EmailConfirmationRequest(BaseModel):
    confirmation_id: str = Field(..., max_length=32)
    email: EmailStr
    report_name: str | None = Field(default=None, max_length=200)


class EmailConfirmationResponse(BaseModel):
    sent: bool = True


class CheckoutResumeResponse(BaseModel):
    purpose: str
    resume: dict[str, Any]


class CheckoutEmbedResponse(BaseModel):
    client_secret: str
    session_id: str
    status: str
    charge_usd: float | None = None


class CheckoutPaymentSummaryResponse(BaseModel):
    brand: str
    last4: str
    amount_usd: float
    currency: str
    session_id_prefix: str


class CheckoutRefundRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=256)
    anon_id: str = Field(..., min_length=8, max_length=128)


class CheckoutRefundResponse(BaseModel):
    ok: bool
    refund_id: str
    brand: str
    last4: str
    amount_usd: float
    balance_credits: int
    stripe_publishable_key: str


class QuoteRequest(BaseModel):
    address: str = Field(..., min_length=3, max_length=500)
    selected_sources: list[str] = Field(default_factory=list)


class EnrichRequest(BaseModel):
    address: str = Field(..., min_length=3, max_length=500)
    selected_sources: list[str] = Field(default_factory=list)
    source_url: HttpUrl | None = None
    source_urls: dict[str, HttpUrl] | None = None
    confirmed_price_usd: float | None = None
    anon_id: str | None = Field(default=None, max_length=128)
    report_id: str | None = Field(default=None, max_length=32)


class EnrichResponse(BaseModel):
    report_id: str
    address_input: str
    display_name: str | None = None
    lat: float | None = None
    lng: float | None = None
    selected_sources: list[str]
    fields: list[PropertyField]
    hazards: dict[str, Any] = Field(default_factory=dict)
    status: str
    message: str | None = None
    crawl_markdown_excerpt: str | None = None
    crawl_source_url: str | None = None
    receipt: dict[str, Any]
    warnings: list[str] = Field(default_factory=list)
    cope: dict[str, Any] | None = None
    conflicts: list[dict[str, Any]] = Field(default_factory=list)
    vision_analysis: dict[str, Any] | None = None
    statement_of_values: dict[str, Any] | None = None
    sov_digest_md: str | None = None
    sov_analysis: dict[str, Any] | None = None


class BatchQuoteRequest(BaseModel):
    addresses: list[str] = Field(..., min_length=1, max_length=100)
    selected_sources: list[str] = Field(default_factory=list)


class BatchEnrichRequest(BaseModel):
    addresses: list[str] = Field(..., min_length=1, max_length=100)
    selected_sources: list[str] = Field(default_factory=list)
    confirmed_price_usd: float | None = None
    anon_id: str | None = Field(default=None, max_length=128)
    batch_id: str | None = Field(default=None, max_length=32)


class BatchEnrichResponse(BaseModel):
    batch_id: str
    selected_sources: list[str]
    locations: list[dict[str, Any]]
    totals: dict[str, Any]
    warnings: list[str] = Field(default_factory=list)
    status: str
    message: str | None = None


class ReportSessionCreate(BaseModel):
    document: dict[str, Any]


class ReportSessionResponse(BaseModel):
    sessionId: str


class ReportSessionDocument(BaseModel):
    document: dict[str, Any]


def extract_simple_facts(markdown: str) -> list[dict[str, Any]]:
    if not markdown:
        return []
    fields: list[dict[str, Any]] = []
    patterns = [
        (r"(?i)parcel\s*(?:#|no\.?|number)?\s*[:\s]+([A-Z0-9\-]+)", "parcel_number"),
        (r"(?i)year\s+built\s*[:\s]+(\d{4})", "year_built"),
        (r"(?i)zoning\s*[:\s]+([A-Za-z0-9\-\s/]+)", "zoning"),
        (r"(?i)assessed\s+value\s*[:\s]+\$?([\d,]+)", "assessed_value"),
        (r"(?i)owner\s*[:\s]+([^\n]+)", "owner_name"),
    ]
    for pattern, key in patterns:
        m = re.search(pattern, markdown)
        if m:
            fields.append(
                {
                    "key": key,
                    "value": m.group(1).strip()[:200],
                    "source": "crawl4ai_heuristic",
                    "confidence": "low",
                }
            )
    return fields


async def crawl_url(url: str) -> tuple[str | None, str | None]:
    try:
        from crawl4ai import AsyncWebCrawler
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail="crawl4ai not installed. Run: pip install -r requirements-crawl4ai.txt && crawl4ai-setup",
        ) from e

    try:
        async with AsyncWebCrawler(verbose=False) as crawler:
            result = await crawler.arun(url=url)
            md = getattr(result, "markdown", None) or ""
            if not md and hasattr(result, "markdown_v2"):
                md = result.markdown_v2 or ""
            excerpt = (md or "")[:8000] if md else None
            return excerpt, url
    except Exception as e:
        return None, f"Crawl failed: {e}"


def _country_hint_from_geo(geo: dict[str, Any]) -> str | None:
    addr = geo.get("address") or {}
    return addr.get("country") or addr.get("country_code")


def _catalog_sources() -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for src in get_sources():
        item = dict(src)
        if src.get("requires_api_key"):
            item["configured"] = _api_key_configured(src)
        else:
            item["configured"] = True
        sources.append(item)
    return sources


def _catalog_payload() -> dict[str, Any]:
    presets = []
    for preset in get_presets():
        item = dict(preset)
        item["source_ids"] = filter_configured_source_ids(preset.get("source_ids") or [])
        presets.append(item)
    return {
        "categories": get_categories(),
        "sources": _catalog_sources(),
        "presets": presets,
        "vendors": get_vendors(),
        "default_selected": [s for s in default_selected_ids() if s != "geocode_census"],
        "margin_multiplier": get_margin_multiplier(),
        "infra_breakeven_usd": get_infra_breakeven_usd(),
        "platform_margin_usd": get_platform_margin_usd(),
    }


def _build_final_receipt(
    quote: dict[str, Any],
    run_results: list[Any],
    *,
    report_id: str,
    credits_charged: int = 0,
) -> dict[str, Any]:
    result_by_id = {r.source_id: r for r in run_results}
    line_items = []
    api_charged = 0.0
    service_charged = 0.0
    multiplier = quote["totals"]["margin_multiplier"]

    for item in quote["line_items"]:
        src = get_source_by_id(item["source_id"])
        run = result_by_id.get(item["source_id"])
        status = run.status if run else "skipped"
        charged = run.charged if run else False
        api_cost = item["api_cost_usd"] if charged else 0.0
        svc_cost = item["service_cost_usd"] if charged else 0.0
        if status == "failed":
            api_cost = 0.0
            svc_cost = 0.0
            charged = False
        api_charged += api_cost
        service_charged += svc_cost
        loaded_line = api_cost + svc_cost
        user_line = round(loaded_line * multiplier, 2) if charged and status == "success" and loaded_line > 0 else 0.0
        line_items.append(
            {
                **item,
                "run_status": status,
                "charged": charged and status == "success",
                "api_cost_usd": api_cost,
                "service_cost_usd": svc_cost,
                "loaded_cost_usd": round(loaded_line, 2),
                "user_price_usd": user_line,
                "message": public_run_message(run.message if run else None),
            }
        )

    loaded = api_charged + service_charged
    user_price = round(loaded * multiplier, 2)

    wallet_on = billing_enabled() and billing_db.is_ready()
    if wallet_on and credits_charged > 0:
        charged_note = f"Charged {credits_charged} credit(s) from prepaid balance"
        charged_flag = True
    elif wallet_on:
        charged_note = "Prepaid wallet active — no charge for this run"
        charged_flag = False
    else:
        charged_note = "Wallet billing not enabled — dry run receipt"
        charged_flag = False

    return {
        "report_id": report_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "line_items": line_items,
        "totals": {
            "api_cost_usd": round(api_charged, 2),
            "service_cost_usd": round(service_charged, 2),
            "loaded_cost_usd": round(loaded, 2),
            "margin_multiplier": multiplier,
            "user_price_usd": user_price,
            "credits_charged": credits_charged,
            "charged": charged_flag,
            "note": charged_note,
        },
        "estimate": quote["totals"],
    }


@app.get("/health")
async def health():
    return {
        "ok": True,
        "service": "property-intelligence-api",
        "version": "0.4.0",
        "billing": billing_status(),
    }


@app.get("/billing/packs")
async def billing_packs():
    return {
        "packs": CREDIT_PACKS,
        "billing_enabled": billing_enabled(),
        "stripe_publishable_key": stripe_publishable_key() if billing_enabled() else "",
    }


@app.get("/billing/balance", response_model=BalanceResponse)
async def billing_balance(anon_id: str = ""):
    aid = anon_id.strip()
    if not aid:
        raise HTTPException(status_code=400, detail="anon_id query parameter required")
    balance = await billing_db.get_balance(aid)
    return BalanceResponse(
        anon_id=aid,
        balance_credits=balance,
        billing_enabled=billing_enabled(),
    )


@app.get("/billing/checkout-status", response_model=CheckoutStatusResponse)
@limiter.limit("120/minute")
async def billing_checkout_status(
    request: Request,
    session_id: str = "",
    anon_id: str = "",
):
    sid = session_id.strip()
    aid = anon_id.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="session_id query parameter required")
    if not aid:
        raise HTTPException(status_code=400, detail="anon_id query parameter required")
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured (STRIPE_SECRET_KEY)")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")
    try:
        result = await get_checkout_status(sid, aid)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        mapped = map_checkout_status_exception(sid, aid, exc)
        raise HTTPException(status_code=mapped.status_code, detail=mapped.detail) from exc
    confirmation_id = None
    stored = await billing_db.get_checkout_resume(sid, aid)
    if stored:
        confirmation_id = stored["payload"].get("confirmation_id")
    return CheckoutStatusResponse(**result, confirmation_id=confirmation_id)


@app.get("/billing/checkout-payment-summary", response_model=CheckoutPaymentSummaryResponse)
@limiter.limit("30/minute")
async def billing_checkout_payment_summary(
    request: Request,
    session_id: str = "",
    anon_id: str = "",
):
    sid = session_id.strip()
    aid = anon_id.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="session_id query parameter required")
    if not aid:
        raise HTTPException(status_code=400, detail="anon_id query parameter required")
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured (STRIPE_SECRET_KEY)")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")
    try:
        result = await get_checkout_payment_summary(sid, aid)
    except ValueError as exc:
        msg = str(exc)
        if "does not belong" in msg:
            raise HTTPException(status_code=403, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    except Exception as exc:
        raise _billing_stripe_http_exception(exc) from exc
    return CheckoutPaymentSummaryResponse(**result)


@app.post("/billing/refund-checkout", response_model=CheckoutRefundResponse)
@limiter.limit("3/minute")
async def billing_refund_checkout(request: Request, body: CheckoutRefundRequest):
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured (STRIPE_SECRET_KEY)")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")
    try:
        result = await refund_checkout_session(body.session_id.strip(), body.anon_id.strip())
    except ValueError as exc:
        msg = str(exc)
        if "does not belong" in msg:
            raise HTTPException(status_code=403, detail=msg) from exc
        if msg == "already_refunded":
            raise HTTPException(status_code=409, detail="This checkout has already been refunded") from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    except Exception as exc:
        raise _billing_stripe_http_exception(exc) from exc
    return CheckoutRefundResponse(**result)


@app.get("/billing/checkout-resume", response_model=CheckoutResumeResponse)
@limiter.limit("30/minute")
async def billing_checkout_resume(
    request: Request,
    session_id: str = "",
    anon_id: str = "",
):
    sid = session_id.strip()
    aid = anon_id.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="session_id query parameter required")
    if not aid:
        raise HTTPException(status_code=400, detail="anon_id query parameter required")
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured (STRIPE_SECRET_KEY)")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")
    try:
        status = await get_checkout_status(sid, aid)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise _billing_stripe_http_exception(exc) from exc
    if status["status"] != "paid":
        raise HTTPException(status_code=402, detail="Payment not completed")
    stored = await billing_db.get_checkout_resume(sid, aid)
    if not stored:
        raise HTTPException(status_code=404, detail="Resume context not found for this checkout")
    return CheckoutResumeResponse(purpose=stored["purpose"], resume=stored["payload"])


@app.get("/billing/checkout-embed", response_model=CheckoutEmbedResponse)
@limiter.limit("30/minute")
async def billing_checkout_embed(
    request: Request,
    session_id: str = "",
    anon_id: str = "",
):
    sid = session_id.strip()
    aid = anon_id.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="session_id query parameter required")
    if not aid:
        raise HTTPException(status_code=400, detail="anon_id query parameter required")
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured (STRIPE_SECRET_KEY)")
    try:
        result = await get_embed_checkout_credentials(sid, aid)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise _billing_stripe_http_exception(exc) from exc
    pk = stripe_publishable_key()
    if not pk:
        raise HTTPException(status_code=503, detail="STRIPE_PUBLISHABLE_KEY not configured")
    return CheckoutEmbedResponse(
        **result,
        stripe_publishable_key=pk,
    )


@app.post("/billing/checkout", response_model=CheckoutResponse)
@limiter.limit("5/minute")
async def billing_checkout(request: Request, body: CheckoutRequest):
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured (STRIPE_SECRET_KEY)")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")
    try:
        session = create_checkout_session(
            anon_id=body.anon_id,
            pack_id=body.pack_id,
            embedded=body.embedded,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise _billing_stripe_http_exception(exc) from exc
    return CheckoutResponse(**session)


@app.get("/billing/checkout-preview", response_model=CheckoutPreviewResponse)
@limiter.limit("30/minute")
async def billing_checkout_preview(
    request: Request,
    anon_id: str = "",
    purpose: str = "enrich",
    address: str = "",
    selected_sources: str = "",
):
    aid = anon_id.strip()
    addr = address.strip()
    if not aid:
        raise HTTPException(status_code=400, detail="anon_id query parameter required")
    if not addr:
        raise HTTPException(status_code=400, detail="address query parameter required")
    if purpose not in ("enrich", "discover", "batch_enrich"):
        raise HTTPException(status_code=400, detail="purpose must be enrich, discover, or batch_enrich")

    sources = [s.strip() for s in selected_sources.split(",") if s.strip()] if selected_sources else []
    batch_addresses = [a.strip() for a in address.split("|") if a.strip()] if purpose == "batch_enrich" else None
    try:
        pricing = await compute_checkout_pricing(
            purpose=purpose,
            address=addr,
            selected_sources=sources,
            anon_id=aid,
            addresses=batch_addresses,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CheckoutPreviewResponse(**pricing)


@app.post("/billing/batch-checkout-preview", response_model=CheckoutPreviewResponse)
@limiter.limit("20/minute")
async def billing_batch_checkout_preview(request: Request, body: BatchCheckoutPreviewRequest):
    aid = body.anon_id.strip()
    cleaned = [a.strip() for a in body.addresses if a and a.strip()]
    if not aid:
        raise HTTPException(status_code=400, detail="anon_id required")
    if not cleaned:
        raise HTTPException(status_code=400, detail="At least one address is required.")
    try:
        pricing = await compute_checkout_pricing(
            purpose="batch_enrich",
            address=cleaned[0],
            selected_sources=body.selected_sources,
            anon_id=aid,
            addresses=cleaned,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CheckoutPreviewResponse(**pricing)


@app.post("/billing/checkout-quote", response_model=CheckoutQuoteResponse)
@limiter.limit("5/minute")
async def billing_checkout_quote(request: Request, body: CheckoutQuoteRequest):
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured (STRIPE_SECRET_KEY)")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")

    addr = body.address.strip()
    addrs = [a.strip() for a in body.addresses if a and a.strip()]
    if body.purpose == "batch_enrich":
        if not addrs:
            raise HTTPException(status_code=400, detail="addresses required for batch_enrich")
    elif not addr:
        raise HTTPException(status_code=400, detail="address required")

    try:
        pricing = await compute_checkout_pricing(
            purpose=body.purpose,
            address=addr or (addrs[0] if addrs else ""),
            selected_sources=body.selected_sources,
            anon_id=body.anon_id,
            addresses=addrs if body.purpose == "batch_enrich" else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if pricing["sufficient"]:
        raise HTTPException(status_code=400, detail="Sufficient credits, no checkout needed")

    if body.confirmed_price_usd is not None and body.purpose in ("enrich", "batch_enrich"):
        expected = pricing["user_price_usd"]
        if abs(body.confirmed_price_usd - expected) > 0.01:
            raise HTTPException(
                status_code=409,
                detail=f"Quote stale: expected ${expected:.2f}, got ${body.confirmed_price_usd:.2f}",
            )

    charge_usd = pricing["charge_usd"]
    credits_to_add = pricing["credits_to_add"]
    if body.purpose == "batch_enrich":
        desc_addr = f"{len(addrs)} locations"
    else:
        desc_addr = addr[:80]
    description = (
        f"{desc_addr} — {credits_to_add} credits"
        if body.purpose in ("enrich", "batch_enrich")
        else f"AI URL discovery — {credits_to_add} credits"
    )

    try:
        session = create_quote_checkout_session(
            anon_id=body.anon_id,
            charge_usd=charge_usd,
            credits_to_add=credits_to_add,
            purpose=body.purpose,
            description=description,
            embedded=body.embedded,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise _billing_stripe_http_exception(exc) from exc

    confirmation_id = _new_confirmation_id(body.purpose)
    resume_payload: dict[str, Any] = {
        "address": addr,
        "addresses": addrs,
        "selected_sources": body.selected_sources,
        "source_urls": body.source_urls,
        "confirmed_price_usd": body.confirmed_price_usd,
        "confirmation_id": confirmation_id,
    }
    await billing_db.save_checkout_resume(
        str(session["session_id"]),
        body.anon_id,
        body.purpose,
        resume_payload,
    )
    await billing_db.save_report_confirmation_pending(
        confirmation_id,
        body.anon_id,
        {
            "purpose": body.purpose,
            "session_id": str(session["session_id"]),
            **resume_payload,
        },
    )

    return CheckoutQuoteResponse(**session, confirmation_id=confirmation_id)


@app.post("/billing/stripe-webhook")
async def billing_stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        result = await handle_webhook_payload(payload, sig)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result


@app.get("/env-status")
async def env_status():
    """Which vendor API keys are set on the server (names only, never values)."""
    return env_status_payload()


@app.get("/catalog")
async def catalog():
    return _catalog_payload()


@app.get("/geocode/census/onelineaddress")
@limiter.limit("80/minute")
async def geocode_census_onelineaddress(
    request: Request,
    address: str = "",
    benchmark: str = "Public_AR_Current",
    format: str = "json",
):
    query = address.strip()
    if not query:
        raise HTTPException(status_code=400, detail="address query parameter required")
    try:
        return await proxy_census_onelineaddress(query, benchmark=benchmark, format=format)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Census geocoder error: {exc}") from exc


@app.get("/geocode/census/coordinates")
@limiter.limit("80/minute")
async def geocode_census_coordinates(
    request: Request,
    x: float | None = None,
    y: float | None = None,
    benchmark: str = "Public_AR_Current",
    format: str = "json",
):
    if x is None or y is None:
        raise HTTPException(status_code=400, detail="x and y query parameters required")
    try:
        return await proxy_census_coordinates(x, y, benchmark=benchmark, format=format)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Census reverse geocoder error: {exc}") from exc


@app.get("/suggest")
@limiter.limit("80/minute")
async def suggest(request: Request, q: str = "", limit: int = 5, country: str = "US"):
    query = q.strip()
    if len(query) < 4:
        return {"results": []}
    try:
        results = await search_addresses(query, limit=min(max(limit, 1), 10), country=country)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Address suggest error: {exc}") from exc
    return {"results": results}


@app.post("/discover-source-urls", response_model=DiscoverSourceUrlsResponse)
@limiter.limit("10/minute")
async def discover_urls(request: Request, body: DiscoverSourceUrlsRequest):
    resolved = resolve_selected_sources_for_request(body.selected_sources or None)
    crawl_ids = [
        sid
        for sid in resolved
        if (get_source_by_id(sid) or {}).get("needs_source_url")
    ]

    try:
        geo = await geocode_address(body.address.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Geocoding service error: {exc}") from exc

    if not geo:
        raise HTTPException(
            status_code=404,
            detail="Address could not be geocoded. Use a full street address with city, state, and ZIP.",
        )

    cached = get_discovery(body.address.strip(), crawl_ids)

    headers = {"User-Agent": "AXIOM-PropertyIntelligence/0.3"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        result = await discover_source_urls(
            address=body.address.strip(),
            display_name=geo.get("display_name"),
            geo=geo,
            crawl_source_ids=crawl_ids,
            client=client,
        )

    return DiscoverSourceUrlsResponse(**result)


@app.post("/quote")
@limiter.limit("40/minute")
async def quote(request: Request, body: QuoteRequest):
    resolved = resolve_selected_sources_for_request(body.selected_sources or None)
    address = body.address.strip()
    if not address:
        raise HTTPException(status_code=400, detail="Address is required.")

    country_hint = "US"
    display_name = None
    lat = None
    lng = None

    try:
        geo = await geocode_address(address)
        if geo:
            display_name = geo.get("display_name")
            lat = geo.get("lat")
            lng = geo.get("lng")
            hint = _country_hint_from_geo(geo)
            if hint:
                country_hint = hint
    except Exception:
        # Pricing is source-driven; geocode refines country availability only.
        pass

    quote_data = build_quote(
        address_input=address,
        selected_sources=resolved,
        display_name=display_name,
        lat=lat,
        lng=lng,
        country_hint=country_hint,
    )
    quote_data["warnings"] = warnings_for_selection(resolved)
    return quote_data


async def _execute_enrich(
    *,
    address: str,
    selected_sources: list[str] | None,
    anon_id: str | None = None,
    source_url: str | None = None,
    source_urls: dict[str, str] | None = None,
    charge_credits: bool = True,
    report_id: str | None = None,
) -> EnrichResponse:
    resolved = resolve_selected_sources_for_request(selected_sources or None)
    rid = report_id or f"AX-{uuid.uuid4().hex[:8].upper()}"

    try:
        geo = await geocode_address(address.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Geocoding service error: {exc}") from exc

    if not geo:
        raise HTTPException(
            status_code=404,
            detail="Address could not be geocoded. Use a full street address with city, state, and ZIP.",
        )

    quote_data = build_quote(
        address_input=address.strip(),
        selected_sources=resolved,
        display_name=geo.get("display_name"),
        lat=geo["lat"],
        lng=geo["lng"],
        country_hint=_country_hint_from_geo(geo),
    )

    enrich_cost = enrich_credits_cost(quote_data)
    if charge_credits:
        await require_and_spend(
            anon_id,
            enrich_cost,
            action="enrich",
            reference_id=rid,
        )

    crawl_ids = [
        sid for sid in resolved if (get_source_by_id(sid) or {}).get("needs_source_url")
    ]
    raw_urls = dict(source_urls or {})
    merged_urls = merge_source_urls(
        source_urls=raw_urls,
        legacy_source_url=source_url,
        crawl_source_ids=crawl_ids,
    )
    crawl_excerpt: str | None = None
    discovery_warnings: list[str] = []
    post_context: dict[str, Any] = {}

    headers = {"User-Agent": "AXIOM-PropertyIntelligence/0.4"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as discovery_client:
        if crawl_ids:
            merged_urls, discovery_warnings = await auto_resolve_crawl_urls(
                address=address.strip(),
                geo=geo,
                crawl_source_ids=crawl_ids,
                existing_urls=merged_urls,
                client=discovery_client,
            )

        has_crawl_urls = any(merged_urls.get(sid) for sid in crawl_ids)

        async def crawl_fn(url: str):
            nonlocal crawl_excerpt
            excerpt, meta = await crawl_url(url)
            if excerpt:
                crawl_excerpt = excerpt
                post_context["crawl_excerpt"] = excerpt
            return excerpt, meta

        geo_result, run_results = await run_report(
            address=address.strip(),
            selected_sources=resolved,
            source_url=source_url,
            source_urls=merged_urls,
            crawl_fn=crawl_fn if has_crawl_urls else None,
            extract_fn=extract_simple_facts,
            post_context=post_context,
        )

    from engine.models import SourceRunResult

    if "cope_map" in resolved and not any(r.source_id == "cope_map" for r in run_results):
        run_results.append(
            SourceRunResult("cope_map", status="success", message="COPE snapshot generated")
        )

    if not geo_result:
        failed = run_results[0] if run_results else None
        raise HTTPException(status_code=404, detail=failed.message if failed else "Geocode failed")

    all_fields: list[PropertyField] = []
    merged_hazards: dict[str, Any] = {}
    success_count = 0
    fail_count = 0

    for run in run_results:
        if run.status == "success":
            success_count += 1
        elif run.status == "failed":
            fail_count += 1
        for f in run.to_legacy_fields():
            if f.get("value"):
                all_fields.append(PropertyField(**f))
        merged_hazards.update(run.hazards)

    receipt = _build_final_receipt(
        quote_data,
        run_results,
        report_id=rid,
        credits_charged=enrich_cost if charge_credits else 0,
    )

    cope_snapshot = None
    conflicts: list[dict[str, Any]] = []
    statement_of_values: dict[str, Any] | None = None
    sov_digest_md: str | None = None
    sov_analysis: dict[str, Any] | None = None
    if "cope_map" in resolved:
        observations = collect_observations_from_results(run_results)
        trusted, conflicts = resolve_all(observations)
        sov_run = next((r for r in run_results if r.source_id == "sov_orchestrator"), None)
        if sov_run and sov_run.trusted_values:
            trusted = sov_run.trusted_values
            conflicts = sov_run.conflicts_override or conflicts
        if sov_run and sov_run.analysis:
            statement_of_values = sov_run.analysis.get("statement_of_values")
            sov_digest_md = sov_run.analysis.get("sov_digest_md")
            sov_analysis = {
                k: sov_run.analysis.get(k)
                for k in ("discrepancies", "enrichments", "underwriter_notes", "summary", "agent_trace")
                if sov_run.analysis.get(k) is not None
            }
        cope_snapshot = build_cope_snapshot_from_trusted(trusted, conflicts=conflicts)

    if success_count <= 1 and fail_count > 0:
        status = "partial"
        message = f"Report {rid}: {fail_count} source(s) failed."
    elif fail_count > 0:
        status = "partial"
        message = f"Report {rid}: completed with {fail_count} skipped or failed source(s)."
    else:
        status = "enriched"
        message = f"Report {rid}: {success_count} source(s) completed."

    warnings = [*warnings_for_selection(resolved), *discovery_warnings]

    vision_analysis: dict[str, Any] | None = None
    vision_run = next((r for r in run_results if r.source_id == "vision_construction"), None)
    if vision_run and vision_run.analysis:
        vision_analysis = vision_run.analysis

    return EnrichResponse(
        report_id=rid,
        address_input=address.strip(),
        display_name=geo_result.get("display_name"),
        lat=geo_result["lat"],
        lng=geo_result["lng"],
        selected_sources=resolved,
        fields=all_fields,
        hazards=merged_hazards,
        status=status,
        message=message,
        crawl_markdown_excerpt=crawl_excerpt,
        crawl_source_url=source_url or (next(iter(merged_urls.values()), None) if merged_urls else None),
        receipt=receipt,
        warnings=warnings,
        cope=cope_snapshot,
        conflicts=conflicts,
        vision_analysis=vision_analysis,
        statement_of_values=statement_of_values,
        sov_digest_md=sov_digest_md,
        sov_analysis=sov_analysis,
    )


async def _persist_confirmation_failure(confirmation_id: str | None, message: str) -> None:
    if not confirmation_id or not billing_db.is_ready():
        return
    await billing_db.update_report_confirmation(
        confirmation_id,
        status="failed",
        payload={"message": message},
    )


@app.post("/quote/batch")
@limiter.limit("10/minute")
async def quote_batch(request: Request, body: BatchQuoteRequest):
    cleaned = [a.strip() for a in body.addresses if a and a.strip()]
    if not cleaned:
        raise HTTPException(status_code=400, detail="At least one address is required.")
    try:
        return await build_batch_quote(addresses=cleaned, selected_sources=body.selected_sources)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/enrich", response_model=EnrichResponse)
@limiter.limit("6/minute")
async def enrich(request: Request, body: EnrichRequest):
    source_url_str = str(body.source_url) if body.source_url else None
    raw_urls = {k: str(v) for k, v in (body.source_urls or {}).items()}
    confirmation_id = body.report_id
    try:
        result = await _execute_enrich(
            address=body.address.strip(),
            selected_sources=body.selected_sources,
            anon_id=body.anon_id,
            source_url=source_url_str,
            source_urls=raw_urls,
            charge_credits=True,
            report_id=confirmation_id,
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else "Report could not be completed."
        await _persist_confirmation_failure(confirmation_id, str(detail))
        raise
    except Exception:
        await _persist_confirmation_failure(confirmation_id, "Report could not be completed.")
        raise
    if confirmation_id and billing_db.is_ready():
        await billing_db.update_report_confirmation(
            confirmation_id,
            status="ready",
            payload=result.model_dump(),
        )
    return result


@app.post("/enrich/batch", response_model=BatchEnrichResponse)
@limiter.limit("3/minute")
async def enrich_batch(request: Request, body: BatchEnrichRequest):
    cleaned = [a.strip() for a in body.addresses if a and a.strip()]
    if not cleaned:
        raise HTTPException(status_code=400, detail="At least one address is required.")

    try:
        batch_quote_data = await build_batch_quote(
            addresses=cleaned,
            selected_sources=body.selected_sources,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    valid_locs = [loc for loc in batch_quote_data["locations"] if loc.get("status") == "valid"]
    if not valid_locs:
        raise HTTPException(status_code=400, detail="No valid locations in schedule.")

    batch_cost = batch_enrich_credits_cost(batch_quote_data)
    batch_id = body.batch_id or f"BX-{uuid.uuid4().hex[:8].upper()}"
    tracked_batch = bool(body.batch_id)
    await require_and_spend(
        body.anon_id,
        batch_cost,
        action="batch_enrich",
        reference_id=batch_id,
    )

    results: list[dict[str, Any]] = []
    success_count = 0
    fail_count = 0

    for loc in batch_quote_data["locations"]:
        if loc.get("status") != "valid":
            results.append(loc)
            continue
        try:
            enrich_result = await _execute_enrich(
                address=loc["address_input"],
                selected_sources=body.selected_sources,
                charge_credits=False,
            )
            success_count += 1
            results.append(
                {
                    **loc,
                    "status": "enriched",
                    "report_id": enrich_result.report_id,
                    "enrich_status": enrich_result.status,
                    "receipt": enrich_result.receipt,
                    "record": enrich_result.model_dump(),
                }
            )
        except HTTPException as exc:
            fail_count += 1
            results.append(
                {
                    **loc,
                    "status": "failed",
                    "error": str(exc.detail),
                }
            )
        except Exception as exc:
            fail_count += 1
            results.append(
                {
                    **loc,
                    "status": "failed",
                    "error": str(exc),
                }
            )

    batch_quote_data["totals"]["credits_charged"] = batch_cost
    if fail_count and success_count:
        status = "partial"
        message = f"Batch {batch_id}: {success_count} enriched, {fail_count} failed."
    elif fail_count:
        status = "failed"
        message = f"Batch {batch_id}: all locations failed."
    else:
        status = "enriched"
        message = f"Batch {batch_id}: {success_count} location(s) enriched."

    response = BatchEnrichResponse(
        batch_id=batch_id,
        selected_sources=batch_quote_data["selected_sources"],
        locations=results,
        totals=batch_quote_data["totals"],
        warnings=batch_quote_data.get("warnings") or [],
        status=status,
        message=message,
    )
    if tracked_batch and billing_db.is_ready():
        await billing_db.update_report_confirmation(
            batch_id,
            status="ready" if status != "failed" else "failed",
            payload=response.model_dump(),
        )
    return response


_CONFIRMATION_ID_RE = re.compile(r"^[AB]X-[0-9A-F]{8}$")


@app.get("/reports/confirmation/{confirmation_id}", response_model=ReportConfirmationResponse)
@limiter.limit("30/minute")
async def get_report_by_confirmation(request: Request, confirmation_id: str):
    cid = confirmation_id.strip().upper()
    if not _CONFIRMATION_ID_RE.match(cid):
        raise HTTPException(status_code=404, detail="Confirmation number not found")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")
    row = await billing_db.get_report_confirmation(cid)
    if not row:
        raise HTTPException(status_code=404, detail="Confirmation number not found")
    row_status = row["status"]
    if row_status == "ready":
        return ReportConfirmationResponse(
            confirmation_id=cid,
            status="ready",
            record=row["payload"],
        )
    if row_status == "pending":
        payload = ReportConfirmationResponse(
            confirmation_id=cid,
            status="pending",
            message="Report is still being prepared.",
        )
        return JSONResponse(status_code=202, content=payload.model_dump())
    message = row["payload"].get("message") if isinstance(row["payload"], dict) else None
    return ReportConfirmationResponse(
        confirmation_id=cid,
        status="failed",
        message=message or "Report could not be completed.",
    )


@app.post("/reports/email-confirmation", response_model=EmailConfirmationResponse)
@limiter.limit("5/minute")
async def email_report_confirmation(request: Request, body: EmailConfirmationRequest):
    cid = body.confirmation_id.strip().upper()
    if not _CONFIRMATION_ID_RE.match(cid):
        raise HTTPException(status_code=404, detail="Confirmation number not found")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")
    if not is_email_configured():
        raise HTTPException(status_code=503, detail="Email delivery is not available right now.")

    row = await billing_db.get_report_confirmation(cid)
    if not row:
        raise HTTPException(status_code=404, detail="Confirmation number not found")

    row_status = row["status"]
    if row_status == "pending":
        raise HTTPException(status_code=409, detail="Report is still being prepared.")
    if row_status == "failed":
        payload = row.get("payload")
        message = payload.get("message") if isinstance(payload, dict) else None
        raise HTTPException(
            status_code=422,
            detail=message or "Report could not be completed.",
        )
    if row_status != "ready":
        raise HTTPException(status_code=404, detail="Confirmation number not found")

    property_label = (body.report_name or "").strip() or property_label_from_payload(row.get("payload"))
    try:
        await send_confirmation_email_async(
            str(body.email),
            cid,
            property_label=property_label or None,
        )
    except smtplib.SMTPAuthenticationError as exc:
        logger.exception("SMTP authentication failed for %s: %s", cid, exc)
        raise HTTPException(
            status_code=503,
            detail="Email delivery is not configured correctly.",
        ) from exc
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        logger.exception("Confirmation email failed for %s: %s", cid, exc)
        raise HTTPException(
            status_code=502,
            detail="We could not send that email right now. Please try again.",
        ) from exc
    except Exception as exc:
        logger.exception("Confirmation email failed for %s: %s", cid, exc)
        raise HTTPException(
            status_code=502,
            detail="We could not send that email right now. Please try again.",
        ) from exc

    return EmailConfirmationResponse()


@app.get("/reports/health")
async def reports_health():
    ready, detail = check_playwright_ready()
    return {
        "ok": ready,
        "service": "report-pdf",
        "playwright": ready,
        "detail": detail,
    }


@app.post("/reports/pdf")
@limiter.limit("10/minute")
async def generate_pdf_direct(request: Request, body: ReportSessionCreate):
    if not body.document:
        raise HTTPException(status_code=400, detail="Report document is required.")
    return await pdf_response_for_document(body.document)


@app.post("/reports/sessions", response_model=ReportSessionResponse)
@limiter.limit("10/minute")
async def create_report_session(request: Request, body: ReportSessionCreate):
    if not body.document:
        raise HTTPException(status_code=400, detail="Report document is required.")
    session_id = create_session(body.document)
    return ReportSessionResponse(sessionId=session_id)


@app.get("/reports/sessions/{session_id}", response_model=ReportSessionDocument)
async def read_report_session(session_id: str):
    return ReportSessionDocument(document=get_session(session_id))


@app.get("/reports/sessions/{session_id}/render", response_class=HTMLResponse)
async def render_report_session(session_id: str):
    return HTMLResponse(content=render_report_html(get_session(session_id)))


@app.post("/reports/sessions/{session_id}/pdf")
@limiter.limit("10/minute")
async def generate_report_pdf(request: Request, session_id: str):
    return await pdf_response(session_id)
