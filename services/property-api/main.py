"""
Property Intelligence API — geocoding + optional Crawl4AI page extraction.

Run: uvicorn main:app --reload --port 8000
Setup: pip install -r requirements.txt && crawl4ai-setup (browser deps)
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, HttpUrl

app = FastAPI(title="AXIOM Property Intelligence API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from geocode import geocode_address


class EnrichRequest(BaseModel):
    address: str = Field(..., min_length=3, max_length=500)
    source_url: HttpUrl | None = None


class PropertyField(BaseModel):
    key: str
    value: str | None
    source: str
    confidence: str  # high | medium | low


class EnrichResponse(BaseModel):
    address_input: str
    display_name: str | None = None
    lat: float | None = None
    lng: float | None = None
    parcel_hint: str | None = None
    fields: list[PropertyField]
    crawl_markdown_excerpt: str | None = None
    crawl_source_url: str | None = None
    status: str
    message: str | None = None


def fields_from_geocode(address: str, geo: dict[str, Any]) -> list[PropertyField]:
    geo_source = geo.get("source") or "nominatim"
    addr = geo.get("address") or {}
    parts = [
        ("property_address", geo.get("display_name") or address, geo_source, "high"),
        (
            "city",
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("municipality"),
            geo_source,
            "high",
        ),
        ("state", addr.get("state"), geo_source, "high"),
        ("postcode", addr.get("postcode") or addr.get("zip"), geo_source, "high"),
        ("country", addr.get("country"), geo_source, "high"),
    ]
    out: list[PropertyField] = []
    for key, value, source, confidence in parts:
        if value:
            out.append(
                PropertyField(key=key, value=str(value), source=source, confidence=confidence)
            )
    return out


def extract_simple_facts(markdown: str) -> list[PropertyField]:
    """Lightweight heuristics on crawled markdown (no LLM required)."""
    if not markdown:
        return []
    fields: list[PropertyField] = []
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
                PropertyField(
                    key=key,
                    value=m.group(1).strip()[:200],
                    source="crawl4ai_heuristic",
                    confidence="low",
                )
            )
    return fields


async def crawl_url(url: str) -> tuple[str | None, str | None]:
    try:
        from crawl4ai import AsyncWebCrawler
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail="crawl4ai not installed. Run: pip install -r requirements.txt && crawl4ai-setup",
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


@app.get("/health")
async def health():
    return {"ok": True, "service": "property-intelligence-api"}


@app.post("/enrich", response_model=EnrichResponse)
async def enrich(body: EnrichRequest):
    try:
        geo = await geocode_address(body.address.strip())
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Geocoding service error: {exc}",
        ) from exc

    if not geo:
        raise HTTPException(
            status_code=404,
            detail=(
                "Address could not be geocoded. Try a full street address with city, state, and ZIP "
                "(e.g. 123 Main St, Portland, OR 97201)."
            ),
        )

    fields = fields_from_geocode(body.address, geo)
    crawl_excerpt: str | None = None
    crawl_url_str: str | None = None
    status = "geocoded"
    provider = geo.get("source") or "geocoder"
    message = f"Geocoded via {provider}. Add source_url to crawl a public property page."

    if body.source_url:
        crawl_excerpt, crawl_meta = await crawl_url(str(body.source_url))
        crawl_url_str = str(body.source_url)
        if crawl_excerpt:
            status = "enriched"
            message = "Geocoded and page content extracted with Crawl4AI."
            fields.extend(extract_simple_facts(crawl_excerpt))
        else:
            status = "partial"
            message = crawl_meta or "Crawl returned no content."

    return EnrichResponse(
        address_input=body.address,
        display_name=geo.get("display_name"),
        lat=geo["lat"],
        lng=geo["lng"],
        parcel_hint=None,
        fields=fields,
        crawl_markdown_excerpt=crawl_excerpt,
        crawl_source_url=crawl_url_str,
        status=status,
        message=message,
    )
