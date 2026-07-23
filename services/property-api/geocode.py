"""Multi-provider geocoding with fallbacks for US and international addresses."""

from __future__ import annotations

import math
import re
from typing import Any

import httpx

from address_std import apply_standardized_to_geo, standardize_address

USER_AGENT = "AXIOM-PropertyIntelligence/0.1 (contact: dev@axiom.local)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
CENSUS_COORDINATES = "https://geocoding.geo.census.gov/geocoder/locations/coordinates"
PHOTON = "https://photon.komoot.io/api/"

US_STATE_ABBR = re.compile(
    r"\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b",
    re.I,
)
US_ZIP = re.compile(r"\b\d{5}(?:-\d{4})?\b")


US_STREET = re.compile(r"\d+\s+[a-zA-Z]", re.I)
HOUSE_NUMBER_RE = re.compile(r"^\s*(\d+[\w/-]*)", re.I)
MAX_REFINE_DRIFT_M = 400.0


def _parse_census_components(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    components: dict[str, Any] = {}
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            if name:
                components[name.lower().replace(" ", "_")] = item.get("value")
    return components


def looks_like_us_address(address: str) -> bool:
    return bool(US_ZIP.search(address) or US_STATE_ABBR.search(address))


def looks_like_us_query(address: str) -> bool:
    """Broader US detection for autocomplete (city-only queries, typos, etc.)."""
    if looks_like_us_address(address):
        return True
    return bool(US_STREET.search(address))


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


async def proxy_census_onelineaddress(
    address: str,
    *,
    benchmark: str = "Public_AR_Current",
    format: str = "json",
) -> dict[str, Any]:
    """Proxy US Census onelineaddress geocoder for browser clients (no CORS)."""
    params = {
        "address": address.strip(),
        "benchmark": benchmark,
        "format": format,
    }
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
        r = await client.get(CENSUS, params=params)
        r.raise_for_status()
        return r.json()


async def proxy_census_coordinates(
    x: float,
    y: float,
    *,
    benchmark: str = "Public_AR_Current",
    format: str = "json",
) -> dict[str, Any]:
    """Proxy US Census reverse geocoder for browser clients (no CORS)."""
    params = {
        "x": x,
        "y": y,
        "benchmark": benchmark,
        "format": format,
    }
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
        r = await client.get(CENSUS_COORDINATES, params=params)
        r.raise_for_status()
        return r.json()


async def _census_matches(client: httpx.AsyncClient, address: str, *, limit: int = 5) -> list[dict[str, Any]]:
    params = {
        "address": address,
        "benchmark": "Public_AR_Current",
        "format": "json",
    }
    r = await client.get(CENSUS, params=params)
    r.raise_for_status()
    matches = (r.json().get("result") or {}).get("addressMatches") or []
    results: list[dict[str, Any]] = []
    for match in matches[:limit]:
        coords = match.get("coordinates") or {}
        lat = coords.get("y")
        lng = coords.get("x")
        if lat is None or lng is None:
            continue
        components = _parse_census_components(match.get("addressComponents"))
        results.append(
            normalize_result(
                display_name=match.get("matchedAddress") or address,
                lat=float(lat),
                lng=float(lng),
                address=components,
                source="us_census",
            )
        )
    return results


async def _census(client: httpx.AsyncClient, address: str) -> dict[str, Any] | None:
    matches = await _census_matches(client, address, limit=1)
    if not matches:
        return None
    match = matches[0]
    return match


def _house_number(address: str) -> str | None:
    match = HOUSE_NUMBER_RE.match(address.strip())
    return match.group(1) if match else None


def _distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = (lat2 - lat1) * 111_000.0
    d_lng = (lng2 - lng1) * 111_000.0 * math.cos(math.radians(lat1))
    return math.hypot(d_lat, d_lng)


def _photon_feature_to_result(feat: dict[str, Any], address: str) -> dict[str, Any] | None:
    geom = feat.get("geometry") or {}
    coords = geom.get("coordinates") or []
    if len(coords) < 2:
        return None
    props = feat.get("properties") or {}
    street_line = " ".join(
        p for p in (props.get("housenumber"), props.get("street")) if p
    ).strip()
    locality_parts = [
        props.get("city"),
        props.get("state"),
        props.get("postcode"),
        props.get("country"),
    ]
    display_parts = [street_line, *[p for p in locality_parts if p]]
    display = ", ".join(p for p in display_parts if p) or props.get("name") or address
    return normalize_result(
        display_name=display,
        lat=float(coords[1]),
        lng=float(coords[0]),
        address={
            k: v
            for k, v in {
                "housenumber": props.get("housenumber"),
                "street": props.get("street"),
                "city": props.get("city"),
                "state": props.get("state"),
                "postcode": props.get("postcode"),
                "country": props.get("country"),
            }.items()
            if v
        },
        source="photon",
    )


def _pick_best_photon_feature(features: list[dict[str, Any]], address: str) -> dict[str, Any] | None:
    if not features:
        return None
    want_hn = _house_number(address)
    want_hn_base = want_hn.split("-")[0] if want_hn else None
    best_feat: dict[str, Any] | None = None
    best_score = -1
    for feat in features:
        props = feat.get("properties") or {}
        hn = str(props.get("housenumber") or "")
        osm_type = str(props.get("type") or props.get("osm_value") or "")
        score = 0
        if want_hn and hn == want_hn:
            score += 12
        elif want_hn_base and hn.startswith(want_hn_base):
            score += 7
        if osm_type in ("house", "building", "residential", "detached"):
            score += 4
        if props.get("street"):
            score += 2
        if str(props.get("countrycode") or "").lower() == "us":
            score += 1
        if score > best_score:
            best_score = score
            best_feat = feat
    return best_feat or features[0]


async def _photon_best(client: httpx.AsyncClient, address: str, *, limit: int = 8) -> dict[str, Any] | None:
    r = await client.get(PHOTON, params={"q": address, "limit": limit, "lang": "en"})
    r.raise_for_status()
    feat = _pick_best_photon_feature(r.json().get("features") or [], address)
    if not feat:
        return None
    return _photon_feature_to_result(feat, address)


async def _photon(client: httpx.AsyncClient, address: str) -> dict[str, Any] | None:
    return await _photon_best(client, address)


async def _refine_with_building_coords(
    client: httpx.AsyncClient,
    address: str,
    result: dict[str, Any],
) -> dict[str, Any]:
    """Census interpolates along the street centerline — refine to OSM building when possible."""
    try:
        photon = await _photon_best(client, result.get("display_name") or address)
        if not photon:
            photon = await _photon_best(client, address)
        if not photon:
            return result
        drift = _distance_meters(result["lat"], result["lng"], photon["lat"], photon["lng"])
        want_hn = _house_number(address) or _house_number(result.get("display_name") or "")
        photon_hn = str((photon.get("address") or {}).get("housenumber") or "")
        hn_match = bool(want_hn and photon_hn and photon_hn.split("-")[0] == want_hn.split("-")[0])
        if hn_match and drift <= MAX_REFINE_DRIFT_M:
            return {
                **result,
                "lat": photon["lat"],
                "lng": photon["lng"],
                "source": "photon",
                "precision": "building",
            }
    except httpx.HTTPError:
        pass
    return result


async def _nominatim_search(
    client: httpx.AsyncClient,
    address: str,
    *,
    countrycodes: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    params: dict[str, str | int] = {
        "q": address,
        "format": "json",
        "limit": limit,
        "addressdetails": 1,
    }
    if countrycodes:
        params["countrycodes"] = countrycodes
    r = await client.get(NOMINATIM, params=params)
    if r.status_code == 429:
        raise httpx.HTTPStatusError("Nominatim rate limit", request=r.request, response=r)
    r.raise_for_status()
    return [
        normalize_result(
            display_name=row.get("display_name") or address,
            lat=float(row["lat"]),
            lng=float(row["lon"]),
            address=row.get("address") or {},
            source="nominatim",
        )
        for row in r.json()
    ]


async def _photon_search(client: httpx.AsyncClient, address: str, *, limit: int = 5) -> list[dict[str, Any]]:
    r = await client.get(PHOTON, params={"q": address, "limit": max(limit * 3, 12), "lang": "en"})
    r.raise_for_status()
    features = r.json().get("features") or []
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for feat in features:
        parsed = _photon_feature_to_result(feat, address)
        if not parsed:
            continue
        key = f"{parsed['lat']:.4f}|{parsed['lng']:.4f}"
        if key in seen:
            continue
        seen.add(key)
        results.append(parsed)
        if len(results) >= limit:
            break
    if not results:
        best = await _photon_best(client, address)
        if best:
            results.append(best)
    return results


def _dedupe_suggestions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in items:
        key = f"{item['label'].lower()}|{item['lat']:.3f}|{item['lng']:.3f}"
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _to_suggest_item(result: dict[str, Any], index: int) -> dict[str, Any]:
    return {
        "id": f"{result['source']}-{index}-{result['lng']:.4f}-{result['lat']:.4f}",
        "label": result["display_name"],
        "lat": result["lat"],
        "lng": result["lng"],
        "source": result["source"],
    }


async def search_addresses(address: str, *, limit: int = 5, country: str | None = "US") -> list[dict[str, Any]]:
    """Multi-provider address suggestions. Census first for US queries (handles typos)."""
    address = address.strip()
    if len(address) < 4:
        return []

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    us_query = (country or "").upper() == "US" or looks_like_us_query(address)
    collected: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
        if us_query:
            try:
                census_results = await _census_matches(client, address, limit=limit)
                for row in census_results:
                    collected.append(await _refine_with_building_coords(client, address, row))
            except httpx.HTTPError:
                pass

        if not any(row.get("source") in ("us_census", "photon") for row in collected):
            try:
                collected.extend(
                    await _nominatim_search(
                        client,
                        address,
                        countrycodes="us" if us_query else None,
                        limit=limit,
                    )
                )
            except httpx.HTTPError:
                pass

            try:
                collected.extend(await _photon_search(client, address, limit=limit))
            except httpx.HTTPError:
                pass

    source_priority = {"us_census": 0, "nominatim": 1, "photon": 2}
    collected.sort(key=lambda row: source_priority.get(row.get("source", ""), 99))

    items = [_to_suggest_item(row, index) for index, row in enumerate(collected)]
    return _dedupe_suggestions(items)[:limit]


def _finalize_geocode(address: str, geo: dict[str, Any] | None, *, line_geo: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Attach standardized vendor-safe address fields before returning geocode results."""
    if not geo:
        return None
    std = standardize_address(input_address=address, geo=geo, line_geo=line_geo)
    return apply_standardized_to_geo(geo, std)


async def geocode_address(address: str) -> dict[str, Any] | None:
    """US: Photon/Census pin + Census lines when available; always standardize before return."""
    address = address.strip()
    if not address:
        return None

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    us_query = looks_like_us_query(address)

    async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
        if us_query:
            photon: dict[str, Any] | None = None
            census: dict[str, Any] | None = None

            try:
                photon = await _photon_best(client, address)
            except httpx.HTTPError:
                photon = None

            try:
                census = await _census(client, address)
                if census:
                    census = await _refine_with_building_coords(client, address, census)
            except httpx.HTTPError:
                census = None

            # Prefer Photon/Census-refined coords for the pin.
            # Use Census text lines only when the house number still matches the input.
            if photon and census:
                want_hn = _house_number(address)
                census_hn = _house_number(str(census.get("display_name") or "")) or str(
                    (census.get("address") or {}).get("fromAddress")
                    or (census.get("address") or {}).get("fromaddress")
                    or (census.get("address") or {}).get("housenumber")
                    or ""
                )
                census_hn_base = census_hn.split("-")[0] if census_hn else ""
                want_base = want_hn.split("-")[0] if want_hn else ""
                census_hn_ok = bool(want_base and census_hn_base and want_base == census_hn_base)
                line_geo = census if census_hn_ok else photon
                merged = {
                    **(census if census_hn_ok else photon),
                    "lat": photon["lat"],
                    "lng": photon["lng"],
                    "source": photon.get("source") or census.get("source"),
                    "precision": photon.get("precision") or census.get("precision") or "building",
                    "address": (line_geo.get("address") or {}),
                    "display_name": line_geo.get("display_name") or photon.get("display_name"),
                }
                return _finalize_geocode(address, merged, line_geo=line_geo)

            if census:
                return _finalize_geocode(address, census, line_geo=census)

            if photon and _house_number(address):
                return _finalize_geocode(address, photon, line_geo=photon)

        try:
            result = await _nominatim(client, address, countrycodes="us" if us_query else None)
            if result:
                return _finalize_geocode(address, result)
        except httpx.HTTPError:
            pass

        try:
            result = await _photon_best(client, address)
            return _finalize_geocode(address, result)
        except httpx.HTTPError:
            return None
