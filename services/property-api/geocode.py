"""Multi-provider geocoding with fallbacks for US and international addresses."""

from __future__ import annotations

import re
from typing import Any

import httpx

USER_AGENT = "AXIOM-PropertyIntelligence/0.1 (contact: dev@axiom.local)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
PHOTON = "https://photon.komoot.io/api/"

US_STATE_ABBR = re.compile(
    r"\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b",
    re.I,
)
US_ZIP = re.compile(r"\b\d{5}(?:-\d{4})?\b")


def looks_like_us_address(address: str) -> bool:
    return bool(US_ZIP.search(address) or US_STATE_ABBR.search(address))


def normalize_result(
    *,
    display_name: str,
    lat: float,
    lng: float,
    address: dict[str, Any] | None,
    source: str,
) -> dict[str, Any]:
    return {
        "display_name": display_name,
        "lat": lat,
        "lng": lng,
        "address": address or {},
        "source": source,
    }


async def _nominatim(client: httpx.AsyncClient, address: str, *, countrycodes: str | None = None) -> dict[str, Any] | None:
    params: dict[str, str | int] = {
        "q": address,
        "format": "json",
        "limit": 1,
        "addressdetails": 1,
    }
    if countrycodes:
        params["countrycodes"] = countrycodes
    r = await client.get(NOMINATIM, params=params)
    if r.status_code == 429:
        raise httpx.HTTPStatusError("Nominatim rate limit", request=r.request, response=r)
    r.raise_for_status()
    data = r.json()
    if not data:
        return None
    row = data[0]
    return normalize_result(
        display_name=row.get("display_name") or address,
        lat=float(row["lat"]),
        lng=float(row["lon"]),
        address=row.get("address") or {},
        source="nominatim",
    )


async def _census(client: httpx.AsyncClient, address: str) -> dict[str, Any] | None:
    params = {
        "address": address,
        "benchmark": "Public_AR_Current",
        "format": "json",
    }
    r = await client.get(CENSUS, params=params)
    r.raise_for_status()
    matches = (r.json().get("result") or {}).get("addressMatches") or []
    if not matches:
        return None
    match = matches[0]
    coords = match.get("coordinates") or {}
    lat = coords.get("y")
    lng = coords.get("x")
    if lat is None or lng is None:
        return None
    components = {}
    for item in match.get("addressComponents") or []:
        name = item.get("name")
        if name:
            components[name.lower().replace(" ", "_")] = item.get("value")
    return normalize_result(
        display_name=match.get("matchedAddress") or address,
        lat=float(lat),
        lng=float(lng),
        address=components,
        source="us_census",
    )


async def _photon(client: httpx.AsyncClient, address: str) -> dict[str, Any] | None:
    r = await client.get(PHOTON, params={"q": address, "limit": 1})
    r.raise_for_status()
    features = r.json().get("features") or []
    if not features:
        return None
    feat = features[0]
    geom = feat.get("geometry") or {}
    coords = geom.get("coordinates") or []
    if len(coords) < 2:
        return None
    props = feat.get("properties") or {}
    parts = [
        props.get("housenumber"),
        props.get("street"),
        props.get("city"),
        props.get("state"),
        props.get("postcode"),
        props.get("country"),
    ]
    display = ", ".join(p for p in parts if p) or props.get("name") or address
    return normalize_result(
        display_name=display,
        lat=float(coords[1]),
        lng=float(coords[0]),
        address={
            k: v
            for k, v in {
                "city": props.get("city"),
                "state": props.get("state"),
                "postcode": props.get("postcode"),
                "country": props.get("country"),
            }.items()
            if v
        },
        source="photon",
    )


async def geocode_address(address: str) -> dict[str, Any] | None:
    """Try Nominatim, then US Census (US-like), then Photon."""
    address = address.strip()
    if not address:
        return None

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    us_like = looks_like_us_address(address)

    async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
        try:
            result = await _nominatim(client, address, countrycodes="us" if us_like else None)
            if result:
                return result
        except httpx.HTTPError:
            pass

        if us_like:
            try:
                result = await _census(client, address)
                if result:
                    return result
            except httpx.HTTPError:
                pass

        try:
            return await _photon(client, address)
        except httpx.HTTPError:
            return None
