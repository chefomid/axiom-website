"""Canonical US address standardization for vendor and LLM API calls."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any, Literal

Quality = Literal["complete", "partial", "unusable"]

US_STATE_TO_ABBR: dict[str, str] = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "district of columbia": "DC",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
}

US_STATE_ABBRS = set(US_STATE_TO_ABBR.values())
HOUSE_NUMBER_RE = re.compile(r"^\s*(\d+[\w/-]*)", re.I)
ZIP_RE = re.compile(r"\b(\d{5})(?:-\d{4})?\b")
COUNTRY_TOKENS = frozenset({"us", "usa", "united states", "united states of america"})


@dataclass(frozen=True)
class StandardizedAddress:
    input: str
    line1: str
    line2: str
    full: str
    house_number: str | None
    street: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    country: str
    lat: float | None
    lng: float | None
    provider: str
    quality: Quality

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def normalize_state(value: str | None) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    upper = text.upper()
    if upper in US_STATE_ABBRS:
        return upper
    mapped = US_STATE_TO_ABBR.get(text.lower())
    return mapped


def normalize_postal_code(value: str | None) -> str | None:
    if not value:
        return None
    match = ZIP_RE.search(str(value))
    return match.group(1) if match else None


def normalize_country(value: str | None, *, default: str = "US") -> str:
    if not value:
        return default
    text = str(value).strip().lower()
    if text in COUNTRY_TOKENS or text == "us":
        return "US"
    if len(text) == 2:
        return text.upper()
    return str(value).strip() or default


def _clean_token(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _join_street_parts(*parts: str | None) -> str | None:
    tokens = [p for p in (_clean_token(p) for p in parts) if p]
    if not tokens:
        return None
    return " ".join(tokens)


def _get_ci(raw: dict[str, Any], *keys: str) -> Any:
    """Case-insensitive dict get across candidate keys."""
    if not raw:
        return None
    lower_map = {str(k).lower(): v for k, v in raw.items()}
    for key in keys:
        if key.lower() in lower_map:
            return lower_map[key.lower()]
    return None


def normalize_components(raw: dict[str, Any] | None, provider: str) -> dict[str, str | None]:
    """Unify Census / Photon / Nominatim address dicts into one shape."""
    raw = raw or {}
    provider = (provider or "").lower()

    house = _clean_token(
        _get_ci(raw, "housenumber", "house_number", "fromAddress", "fromaddress", "from_address")
    )
    pre_dir = _clean_token(_get_ci(raw, "preDirection", "predirection", "pre_direction", "preDirectional"))
    street_name = _clean_token(_get_ci(raw, "streetName", "streetname", "street_name"))
    street_type = _clean_token(_get_ci(raw, "suffixType", "suffixtype", "suffix_type", "streettype"))
    street = _clean_token(_get_ci(raw, "street", "road"))
    if not street and (street_name or pre_dir or street_type):
        street = _join_street_parts(pre_dir, street_name, street_type)

    city = _clean_token(_get_ci(raw, "city", "town", "village", "municipality", "city_name"))
    state = normalize_state(_clean_token(_get_ci(raw, "state", "state_code", "region")))
    postal = normalize_postal_code(
        _clean_token(_get_ci(raw, "postcode", "postal_code", "zip", "zipcode"))
    )
    country = normalize_country(_clean_token(_get_ci(raw, "country", "country_code", "countrycode")))

    return {
        "house_number": house,
        "street": street,
        "city": city,
        "state": state,
        "postal_code": postal,
        "country": country,
    }


def _parse_free_text(address: str) -> dict[str, str | None]:
    """Best-effort parse when structured components are thin."""
    text = (address or "").strip()
    if not text:
        return {
            "house_number": None,
            "street": None,
            "city": None,
            "state": None,
            "postal_code": None,
            "country": "US",
        }

    postal = normalize_postal_code(text)
    country = "US"
    # Drop trailing country token
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if parts and parts[-1].lower() in COUNTRY_TOKENS:
        parts = parts[:-1]

    state: str | None = None
    city: str | None = None
    line1: str | None = None

    if len(parts) >= 3:
        # "1221, Southwest 4th Avenue, Portland, Oregon, 97204"
        # or "1221 SW 4TH AVE, PORTLAND, OR, 97204"
        maybe_house = parts[0]
        maybe_street = parts[1]
        if HOUSE_NUMBER_RE.match(maybe_house) and not re.search(r"[A-Za-z]{2,}", maybe_house):
            # Photon-style: house alone in first segment
            line1 = f"{maybe_house} {maybe_street}".strip()
            city = parts[2] if len(parts) > 2 else None
            state = normalize_state(parts[3]) if len(parts) > 3 else None
            if not postal and len(parts) > 4:
                postal = normalize_postal_code(parts[4])
        else:
            line1 = parts[0]
            city = parts[1]
            # state may be "OR" or "OR 97204"
            state_chunk = parts[2]
            state = normalize_state(state_chunk.split()[0] if state_chunk else None)
            if not postal:
                postal = normalize_postal_code(state_chunk) or (
                    normalize_postal_code(parts[3]) if len(parts) > 3 else None
                )
    elif len(parts) == 2:
        line1 = parts[0]
        rest = parts[1]
        rest_bits = rest.split()
        # "Portland OR 97204" or "Portland, OR 97204" already split
        if len(rest_bits) >= 2:
            maybe_state = normalize_state(rest_bits[-2]) if not postal else normalize_state(rest_bits[-1])
            if postal and len(rest_bits) >= 2:
                state = normalize_state(rest_bits[-1]) if normalize_state(rest_bits[-1]) else normalize_state(rest_bits[-2])
                # city is everything before state
                if state and rest_bits[-1].upper() == state:
                    city = " ".join(rest_bits[:-1]) or None
                elif state and len(rest_bits) >= 2 and rest_bits[-2].upper() == state:
                    city = " ".join(rest_bits[:-2]) or None
                else:
                    city = rest
            else:
                state = maybe_state
                city = " ".join(rest_bits[:-2]) if state and postal else rest
        else:
            city = rest
    else:
        # Single chunk: "1221 Southwest 4th Avenue Portland OR 97204"
        line1 = text
        state_match = re.search(
            r"\b(" + "|".join(US_STATE_ABBRS) + r")\b",
            text,
            re.I,
        )
        if state_match:
            state = state_match.group(1).upper()
        name_match = None
        for name, abbr in US_STATE_TO_ABBR.items():
            if re.search(rf"\b{re.escape(name)}\b", text, re.I):
                name_match = abbr
                break
        if not state and name_match:
            state = name_match

    house = None
    street = None
    if line1:
        hn = HOUSE_NUMBER_RE.match(line1)
        if hn:
            house = hn.group(1)
            remainder = line1[hn.end() :].strip(" ,")
            street = remainder or None
        else:
            street = line1

    # If state/zip still embedded in line1 tail, trim them out of street later via rebuild
    if postal and line1 and postal in line1:
        line1 = line1.replace(postal, "").strip(" ,")
    if state and line1:
        line1 = re.sub(rf"\b{re.escape(state)}\b", "", line1, flags=re.I).strip(" ,")
        for name, abbr in US_STATE_TO_ABBR.items():
            if abbr == state:
                line1 = re.sub(rf"\b{re.escape(name)}\b", "", line1, flags=re.I).strip(" ,")

    if line1:
        hn = HOUSE_NUMBER_RE.match(line1)
        if hn:
            house = hn.group(1)
            street = line1[hn.end() :].strip(" ,") or street

    return {
        "house_number": house,
        "street": street,
        "city": city,
        "state": state,
        "postal_code": postal,
        "country": country,
    }


def build_line1(house_number: str | None, street: str | None) -> str:
    return _join_street_parts(house_number, street) or ""


def build_line2(city: str | None, state: str | None, postal_code: str | None) -> str:
    left = ", ".join(p for p in (_clean_token(city), _clean_token(state)) if p)
    if postal_code:
        return f"{left} {postal_code}".strip() if left else postal_code
    return left


def build_full(line1: str, line2: str) -> str:
    line1 = (line1 or "").strip()
    line2 = (line2 or "").strip()
    if line1 and line2:
        return f"{line1}, {line2}"
    return line1 or line2


def _line1_is_house_only(line1: str) -> bool:
    text = (line1 or "").strip()
    if not text:
        return True
    return bool(HOUSE_NUMBER_RE.fullmatch(text))


def _merge_components(
    primary: dict[str, str | None],
    secondary: dict[str, str | None],
) -> dict[str, str | None]:
    out = dict(primary)
    for key, value in secondary.items():
        if not out.get(key) and value:
            out[key] = value
    return out


def _quality_for(line1: str, city: str | None, state: str | None, postal: str | None) -> Quality:
    if not line1 or _line1_is_house_only(line1):
        return "unusable"
    if city and state and postal:
        return "complete"
    return "partial"


def standardize_address(
    *,
    input_address: str,
    geo: dict[str, Any] | None = None,
    line_geo: dict[str, Any] | None = None,
) -> StandardizedAddress:
    """
    Build a vendor-safe address from geocode result(s).

    Prefer structured components from ``line_geo`` (typically Census) for text lines,
    while keeping lat/lng from ``geo`` (may be Photon-refined).
    """
    geo = geo or {}
    line_source = line_geo if line_geo is not None else geo
    input_text = (input_address or "").strip()

    provider = str(line_source.get("source") or geo.get("source") or "parsed")
    coords_lat = geo.get("lat")
    coords_lng = geo.get("lng")

    from_line = normalize_components(line_source.get("address") or {}, str(line_source.get("source") or provider))
    from_geo = normalize_components(geo.get("address") or {}, str(geo.get("source") or provider))
    from_text = _parse_free_text(line_source.get("display_name") or input_text)
    from_input = _parse_free_text(input_text)

    # Prefer Census/line components, then pin geo, then display/input free-text.
    merged = _merge_components(from_line, from_geo)
    merged = _merge_components(merged, from_text)
    merged = _merge_components(merged, from_input)

    input_hn = from_input.get("house_number")
    input_hn_base = input_hn.split("-")[0] if input_hn else None

    # If Census matchedAddress is present, prefer its street line when house number agrees.
    matched = _clean_token(line_source.get("display_name")) if str(line_source.get("source")) == "us_census" else None
    if matched:
        matched_parts = _parse_free_text(matched)
        matched_hn = matched_parts.get("house_number")
        matched_base = matched_hn.split("-")[0] if matched_hn else None
        hn_ok = (not input_hn_base) or (matched_base and matched_base == input_hn_base)
        if hn_ok and matched_parts.get("house_number") and matched_parts.get("street"):
            merged["house_number"] = matched_parts["house_number"]
            merged["street"] = matched_parts["street"]
            merged = _merge_components(merged, matched_parts)

    # Never let a mismatched provider overwrite the caller's house number.
    if input_hn_base:
        merged_hn = merged.get("house_number")
        merged_base = merged_hn.split("-")[0] if merged_hn else None
        if merged_base != input_hn_base:
            if from_input.get("street") or from_geo.get("street"):
                merged["house_number"] = input_hn
                if from_input.get("street"):
                    merged["street"] = from_input.get("street")
                elif from_geo.get("street"):
                    merged["street"] = from_geo.get("street")

    line1 = build_line1(merged.get("house_number"), merged.get("street"))
    if _line1_is_house_only(line1):
        # Last resort: rebuild from free-text parse of input/display
        fallback = _parse_free_text(input_text) if input_text else from_text
        line1 = build_line1(fallback.get("house_number"), fallback.get("street"))
        merged = _merge_components(merged, fallback)

    line2 = build_line2(merged.get("city"), merged.get("state"), merged.get("postal_code"))
    full = build_full(line1, line2)
    if not full:
        full = input_text

    country = merged.get("country") or "US"
    # Non-US pass-through: keep input as full when we cannot build a US street line.
    if country != "US" and _quality_for(line1, merged.get("city"), merged.get("state"), merged.get("postal_code")) == "unusable":
        return StandardizedAddress(
            input=input_text,
            line1=input_text,
            line2="",
            full=input_text,
            house_number=merged.get("house_number"),
            street=merged.get("street"),
            city=merged.get("city"),
            state=merged.get("state"),
            postal_code=merged.get("postal_code"),
            country=country,
            lat=float(coords_lat) if coords_lat is not None else None,
            lng=float(coords_lng) if coords_lng is not None else None,
            provider=provider,
            quality="partial",
        )

    quality = _quality_for(line1, merged.get("city"), merged.get("state"), merged.get("postal_code"))
    return StandardizedAddress(
        input=input_text,
        line1=line1,
        line2=line2,
        full=full,
        house_number=merged.get("house_number"),
        street=merged.get("street"),
        city=merged.get("city"),
        state=merged.get("state"),
        postal_code=merged.get("postal_code"),
        country=country or "US",
        lat=float(coords_lat) if coords_lat is not None else None,
        lng=float(coords_lng) if coords_lng is not None else None,
        provider=provider,
        quality=quality,
    )


def apply_standardized_to_geo(
    geo: dict[str, Any],
    std: StandardizedAddress,
) -> dict[str, Any]:
    """Attach standardized dict and set display_name to vendor-safe full line."""
    out = dict(geo)
    payload = std.to_dict()
    out["standardized"] = payload
    if std.full:
        out["display_name"] = std.full
    # Keep structured address aligned for downstream city/state readers.
    addr = dict(out.get("address") or {})
    if std.house_number:
        addr["housenumber"] = std.house_number
    if std.street:
        addr["street"] = std.street
    if std.city:
        addr["city"] = std.city
    if std.state:
        addr["state"] = std.state
    if std.postal_code:
        addr["postcode"] = std.postal_code
        addr["zip"] = std.postal_code
    if std.country:
        addr["country"] = std.country
    out["address"] = addr
    return out


def vendor_address(ctx: Any) -> dict[str, Any]:
    """Lookup standardized address from SourceContext or geo."""
    if ctx is None:
        return {}
    std = getattr(ctx, "address_std", None)
    if isinstance(std, dict) and std:
        return std
    geo = getattr(ctx, "geo", None) or {}
    if isinstance(geo, dict):
        nested = geo.get("standardized")
        if isinstance(nested, dict) and nested:
            return nested
    return {}


def attom_address_params(std: dict[str, Any] | StandardizedAddress | None) -> dict[str, str]:
    """Build ATTOM address1/address2 from standardized address."""
    if isinstance(std, StandardizedAddress):
        data = std.to_dict()
    else:
        data = std or {}
    line1 = str(data.get("line1") or "").strip()
    line2 = str(data.get("line2") or "").strip()
    if not line2:
        city = data.get("city") or ""
        state = data.get("state") or ""
        postal = data.get("postal_code") or ""
        line2 = build_line2(city, state, postal)
    return {"address1": line1, "address2": line2}
