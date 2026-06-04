"""
Property Intelligence API — à la carte sources, quoting, and enrichment.

Run: uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from pathlib import Path
from typing import Any

from billing.config import billing_enabled, billing_status
from billing.credits import discovery_credits_cost, enrich_credits_cost
from billing import db as billing_db
from billing.gate import require_and_spend
from billing.packs import CREDIT_PACKS
from billing.stripe_service import create_checkout_session, handle_webhook_payload
from env_loader import env_status_payload, load_project_env
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, HttpUrl

from geocode import geocode_address, search_addresses
from merger.cope import build_cope_snapshot_from_trusted
from merger.trust import collect_observations_from_results, resolve_all
from planner.quote import _api_key_configured, build_quote, warnings_for_selection
from engine.executor import merge_source_urls
from planner.runner import run_report
from source_discovery.discover import discover_source_urls
from source_discovery.cache import get_discovery
from registry_loader import (
    default_selected_ids,
    get_categories,
    get_presets,
    get_source_by_id,
    get_sources,
    get_vendors,
    resolve_selected_sources,
)
from report_html import render_report_html
from report_pdf import (
    check_playwright_ready,
    create_session,
    get_session,
    pdf_response,
    pdf_response_for_document,
)

load_project_env()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await billing_db.init_db()
    except Exception as exc:
        print(f"Billing database init failed: {exc}")
    yield
    await billing_db.close_db()


app = FastAPI(title="AXIOM Property Intelligence API", version="0.4.0", lifespan=lifespan)

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://www.axiompropertycasualty.com",
    "https://axiompropertycasualty.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
    receipt: dict[str, Any]
    cached: bool = False


class CheckoutRequest(BaseModel):
    anon_id: str = Field(..., min_length=8, max_length=128)
    pack_id: str = Field(..., min_length=3, max_length=64)


class CheckoutResponse(BaseModel):
    url: str
    session_id: str


class BalanceResponse(BaseModel):
    anon_id: str
    balance_credits: int
    billing_enabled: bool


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
    return {
        "categories": get_categories(),
        "sources": _catalog_sources(),
        "presets": get_presets(),
        "vendors": get_vendors(),
        "default_selected": [s for s in default_selected_ids() if s != "geocode_census"],
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
        line_items.append(
            {
                **item,
                "run_status": status,
                "charged": charged and status == "success",
                "api_cost_usd": api_cost,
                "service_cost_usd": svc_cost,
                "message": run.message if run else None,
            }
        )

    loaded = api_charged + service_charged
    multiplier = quote["totals"]["margin_multiplier"]
    user_price = round(loaded * multiplier, 2)
    min_charge = quote["totals"].get("minimum_charge_usd") or 0.99
    if api_charged > 0 and user_price < min_charge:
        user_price = min_charge

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
    return {"packs": CREDIT_PACKS, "billing_enabled": billing_enabled()}


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


@app.post("/billing/checkout", response_model=CheckoutResponse)
async def billing_checkout(body: CheckoutRequest):
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured (STRIPE_SECRET_KEY)")
    if not billing_db.is_ready():
        raise HTTPException(status_code=503, detail="Billing database not ready")
    try:
        session = create_checkout_session(anon_id=body.anon_id, pack_id=body.pack_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc}") from exc
    return CheckoutResponse(**session)


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


@app.get("/suggest")
async def suggest(q: str = "", limit: int = 5, country: str = "US"):
    query = q.strip()
    if len(query) < 4:
        return {"results": []}
    try:
        results = await search_addresses(query, limit=min(max(limit, 1), 10), country=country)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Address suggest error: {exc}") from exc
    return {"results": results}


@app.post("/discover-source-urls", response_model=DiscoverSourceUrlsResponse)
async def discover_urls(body: DiscoverSourceUrlsRequest):
    resolved = resolve_selected_sources(body.selected_sources or None)
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
    if billing_enabled() and not cached:
        await require_and_spend(
            body.anon_id,
            discovery_credits_cost(),
            action="discover_source_urls",
        )

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
async def quote(body: QuoteRequest):
    resolved = resolve_selected_sources(body.selected_sources or None)
    country_hint = None
    display_name = None
    lat = None
    lng = None

    try:
        geo = await geocode_address(body.address.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Geocoding service error: {exc}") from exc

    if geo:
        display_name = geo.get("display_name")
        lat = geo.get("lat")
        lng = geo.get("lng")
        country_hint = _country_hint_from_geo(geo)
    else:
        raise HTTPException(
            status_code=404,
            detail="Address could not be geocoded. Use a full street address with city, state, and ZIP.",
        )

    quote_data = build_quote(
        address_input=body.address.strip(),
        selected_sources=resolved,
        display_name=display_name,
        lat=lat,
        lng=lng,
        country_hint=country_hint,
    )
    quote_data["warnings"] = warnings_for_selection(resolved)
    return quote_data


@app.post("/enrich", response_model=EnrichResponse)
async def enrich(body: EnrichRequest):
    resolved = resolve_selected_sources(body.selected_sources or None)

    try:
        geo = await geocode_address(body.address.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Geocoding service error: {exc}") from exc

    if not geo:
        raise HTTPException(
            status_code=404,
            detail="Address could not be geocoded. Use a full street address with city, state, and ZIP.",
        )

    quote_data = build_quote(
        address_input=body.address.strip(),
        selected_sources=resolved,
        display_name=geo.get("display_name"),
        lat=geo["lat"],
        lng=geo["lng"],
        country_hint=_country_hint_from_geo(geo),
    )

    enrich_cost = enrich_credits_cost(quote_data)
    report_id = f"AX-{uuid.uuid4().hex[:8].upper()}"
    await require_and_spend(
        body.anon_id,
        enrich_cost,
        action="enrich",
        reference_id=report_id,
    )

    source_url_str = str(body.source_url) if body.source_url else None
    crawl_ids = [
        sid
        for sid in resolved
        if (get_source_by_id(sid) or {}).get("needs_source_url")
    ]
    raw_urls = {k: str(v) for k, v in (body.source_urls or {}).items()}
    merged_urls = merge_source_urls(
        source_urls=raw_urls,
        legacy_source_url=source_url_str,
        crawl_source_ids=crawl_ids,
    )
    has_crawl_urls = bool(merged_urls)
    crawl_excerpt: str | None = None

    async def crawl_fn(url: str):
        nonlocal crawl_excerpt
        excerpt, meta = await crawl_url(url)
        if excerpt:
            crawl_excerpt = excerpt
        return excerpt, meta

    geo_result, run_results = await run_report(
        address=body.address.strip(),
        selected_sources=resolved,
        source_url=source_url_str,
        source_urls=merged_urls,
        crawl_fn=crawl_fn if has_crawl_urls else None,
        extract_fn=extract_simple_facts,
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
        report_id=report_id,
        credits_charged=enrich_cost,
    )

    field_dicts = [f.model_dump() for f in all_fields]
    cope_snapshot = None
    conflicts: list[dict[str, Any]] = []
    if "cope_map" in resolved:
        observations = collect_observations_from_results(run_results)
        trusted, conflicts = resolve_all(observations)
        llm_run = next((r for r in run_results if r.source_id == "llm_conflict_resolve"), None)
        if llm_run and llm_run.trusted_values:
            trusted = llm_run.trusted_values
            conflicts = llm_run.conflicts_override or conflicts
        cope_snapshot = build_cope_snapshot_from_trusted(trusted, conflicts=conflicts)

    if success_count <= 1 and fail_count > 0:
        status = "partial"
        message = f"Report {report_id}: {fail_count} source(s) failed."
    elif fail_count > 0:
        status = "partial"
        message = f"Report {report_id}: completed with {fail_count} skipped or failed source(s)."
    else:
        status = "enriched"
        message = f"Report {report_id}: {success_count} source(s) completed."

    warnings = warnings_for_selection(resolved)

    return EnrichResponse(
        report_id=report_id,
        address_input=body.address.strip(),
        display_name=geo_result.get("display_name"),
        lat=geo_result["lat"],
        lng=geo_result["lng"],
        selected_sources=resolved,
        fields=all_fields,
        hazards=merged_hazards,
        status=status,
        message=message,
        crawl_markdown_excerpt=crawl_excerpt,
        crawl_source_url=source_url_str or (next(iter(merged_urls.values()), None) if merged_urls else None),
        receipt=receipt,
        warnings=warnings,
        cope=cope_snapshot,
        conflicts=conflicts,
    )


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
async def generate_pdf_direct(body: ReportSessionCreate):
    if not body.document:
        raise HTTPException(status_code=400, detail="Report document is required.")
    return await pdf_response_for_document(body.document)


@app.post("/reports/sessions", response_model=ReportSessionResponse)
async def create_report_session(body: ReportSessionCreate):
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
async def generate_report_pdf(session_id: str):
    return await pdf_response(session_id)
