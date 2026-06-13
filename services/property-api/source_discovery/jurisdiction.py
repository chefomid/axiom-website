"""Deterministic public-record portal hints from geocoded jurisdiction (no AI)."""

from __future__ import annotations

from typing import Any

import httpx

NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"

# Curated portal entry points — expanded over time; best-effort when AI discovery fails.
JURISDICTION_PORTALS: list[dict[str, Any]] = [
    {
        "match": {"city": "portland", "state": "OR"},
        "urls": {
            "permit_crawl": {
                "url": "https://www.portlandmaps.com/",
                "label": "PortlandMaps — city permits & property",
                "confidence": "medium",
                "reason": "Portland OR building permit and property portal",
            },
            "assessor_crawl": {
                "url": "https://multco.us/assessment-taxation/property-search",
                "label": "Multnomah County property search",
                "confidence": "medium",
                "reason": "Multnomah County assessor parcel lookup",
            },
        },
    },
    {
        "match": {"county": "multnomah", "state": "OR"},
        "urls": {
            "assessor_crawl": {
                "url": "https://multco.us/assessment-taxation/property-search",
                "label": "Multnomah County property search",
                "confidence": "medium",
                "reason": "Multnomah County assessor parcel lookup",
            },
        },
    },
]


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _norm_county(value: str | None) -> str:
    return _norm(value).replace(" county", "")


def enrich_geo_jurisdiction(geo: dict[str, Any]) -> dict[str, Any]:
    """Return geo with best-effort city/county/state filled from address components."""
    out = dict(geo)
    addr = dict(out.get("address") or {})
    for key in ("city", "town", "county", "state", "postcode", "zip"):
        if addr.get(key):
            continue
    out["address"] = addr
    return out


async def reverse_geocode_jurisdiction(
    client: httpx.AsyncClient,
    *,
    lat: float,
    lng: float,
) -> dict[str, str]:
    try:
        r = await client.get(
            NOMINATIM_REVERSE,
            params={
                "lat": lat,
                "lon": lng,
                "format": "json",
                "addressdetails": 1,
                "zoom": 10,
            },
            headers={"User-Agent": "AXIOM-PropertyIntelligence/0.4"},
            timeout=8.0,
        )
        if r.status_code != 200:
            return {}
        data = r.json()
        addr = data.get("address") or {}
        return {
            "city": addr.get("city") or addr.get("town") or addr.get("village") or "",
            "county": addr.get("county") or "",
            "state": addr.get("state") or "",
        }
    except Exception:
        return {}


async def enrich_geo_with_jurisdiction(client: httpx.AsyncClient, geo: dict[str, Any]) -> dict[str, Any]:
    out = enrich_geo_jurisdiction(geo)
    addr = dict(out.get("address") or {})
    lat = out.get("lat")
    lng = out.get("lng")
    if lat is not None and lng is not None and (not addr.get("county") or not addr.get("city")):
        rev = await reverse_geocode_jurisdiction(client, lat=float(lat), lng=float(lng))
        for key, value in rev.items():
            if value and not addr.get(key):
                addr[key] = value
    if addr.get("town") and not addr.get("city"):
        addr["city"] = addr["town"]
    out["address"] = addr
    return out


def guess_public_portal_urls(geo: dict[str, Any], crawl_source_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Return portal URL candidates from jurisdiction tables."""
    addr = geo.get("address") or {}
    city = _norm(addr.get("city") or addr.get("town"))
    county = _norm_county(addr.get("county"))
    state = _norm(addr.get("state")).upper()

    found: dict[str, dict[str, Any]] = {}
    for entry in JURISDICTION_PORTALS:
        match = entry.get("match") or {}
        m_city = _norm(match.get("city"))
        m_county = _norm_county(match.get("county"))
        m_state = (match.get("state") or "").upper()
        if m_state and state and m_state != state:
            continue
        if m_city and city != m_city:
            continue
        if m_county and county != m_county:
            continue
        if not m_city and not m_county:
            continue
        for sid in crawl_source_ids:
            if sid in found:
                continue
            candidate = (entry.get("urls") or {}).get(sid)
            if candidate:
                found[sid] = dict(candidate)
    return found
