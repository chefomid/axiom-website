"""Discover public assessor / permit portal URLs via OpenAI web search."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from llm.openai_client import openai_api_key, responses_with_web_search
from registry_loader import get_margin_multiplier, get_minimum_charge, get_source_by_id
from source_discovery.cache import get_discovery, set_discovery
from source_discovery.url_validate import validate_public_https_url, verify_url_reachable

DISCOVER_API_COST_USD = 0.03
DISCOVER_SERVICE_COST_USD = 0.07

CRAWL_SOURCE_PROMPTS: dict[str, str] = {
    "assessor_crawl": (
        "Find the official county or municipal property assessor / parcel search page "
        "for this address. Prefer .gov or official county domains. "
        "Return a direct search or parcel page URL, not a generic homepage when possible."
    ),
    "permit_crawl": (
        "Find the official public building permit portal for this jurisdiction "
        "(city or county). Prefer .gov domains. Return a portal where permit records can be searched."
    ),
}

INSTRUCTIONS = """You help insurance underwriters find official public record web pages.
Use web search to find real, current URLs. Only suggest publicly accessible HTTPS pages
(typically .gov or official county/city sites). Do not invent URLs.
Reply with JSON only, no markdown fences:
{
  "assessor_crawl": { "url": "https://...", "label": "County name + page type", "confidence": "high|medium|low", "reason": "one sentence" },
  "permit_crawl": { "url": "https://...", "label": "...", "confidence": "high|medium|low", "reason": "..." }
}
Include only keys that were requested. If you cannot find a reliable URL for a key, omit that key."""


def discovery_receipt() -> dict[str, float]:
    api_cost = DISCOVER_API_COST_USD
    service_cost = DISCOVER_SERVICE_COST_USD
    loaded = api_cost + service_cost
    multiplier = get_margin_multiplier()
    user_price = round(loaded * multiplier, 2)
    min_charge = get_minimum_charge()
    if api_cost > 0 and user_price < min_charge:
        user_price = min_charge
    return {
        "api_cost_usd": round(api_cost, 2),
        "service_cost_usd": round(service_cost, 2),
        "loaded_cost_usd": round(loaded, 2),
        "margin_multiplier": multiplier,
        "user_price_usd": user_price,
    }


def _parse_discovery_json(text: str) -> dict[str, dict[str, Any]]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for key, val in parsed.items():
        if isinstance(val, dict) and val.get("url"):
            out[str(key)] = {
                "url": str(val["url"]).strip(),
                "label": str(val.get("label") or key),
                "confidence": str(val.get("confidence") or "medium"),
                "reason": str(val.get("reason") or ""),
            }
    return out


async def discover_source_urls(
    *,
    address: str,
    display_name: str | None,
    geo: dict[str, Any],
    crawl_source_ids: list[str],
    client: httpx.AsyncClient,
) -> dict[str, Any]:
    """
    Return discovery payload: urls, discover_available, message, receipt, cached.
    """
    receipt = discovery_receipt()
    api_key = openai_api_key()

    if not crawl_source_ids:
        return {
            "urls": {},
            "discover_available": bool(api_key),
            "message": "No crawl sources selected",
            "receipt": receipt,
            "cached": False,
        }

    if not api_key:
        return {
            "urls": {},
            "discover_available": False,
            "message": "AI discovery unavailable — add OPENAI_API_KEY to server .env",
            "receipt": receipt,
            "cached": False,
        }

    cached = get_discovery(address, crawl_source_ids)
    if cached:
        return {**cached, "cached": True, "receipt": receipt}

    addr = geo.get("address") or {}
    location_bits = [
        display_name or address,
        addr.get("county"),
        addr.get("city") or addr.get("town"),
        addr.get("state"),
        addr.get("postcode") or addr.get("zip"),
    ]
    location_line = ", ".join(x for x in location_bits if x)

    tasks_desc = []
    for sid in crawl_source_ids:
        src = get_source_by_id(sid) or {}
        label = src.get("label") or sid
        hint = CRAWL_SOURCE_PROMPTS.get(sid, f"Find a public page for: {label}")
        tasks_desc.append(f"- {sid} ({label}): {hint}")

    user_input = (
        f"Property address: {location_line}\n"
        f"Coordinates: {geo.get('lat')}, {geo.get('lng')}\n\n"
        f"Find URLs for these sources:\n" + "\n".join(tasks_desc)
    )

    try:
        raw_text = await responses_with_web_search(
            client=client,
            api_key=api_key,
            instructions=INSTRUCTIONS,
            user_input=user_input,
        )
    except httpx.HTTPStatusError as e:
        detail = e.response.text[:200] if e.response else str(e)
        return {
            "urls": {},
            "discover_available": True,
            "message": f"AI discovery failed: {detail}",
            "receipt": receipt,
            "cached": False,
        }
    except Exception as e:
        return {
            "urls": {},
            "discover_available": True,
            "message": f"AI discovery failed: {e}",
            "receipt": receipt,
            "cached": False,
        }

    parsed = _parse_discovery_json(raw_text)
    validated: dict[str, dict[str, Any]] = {}
    errors: list[str] = []

    for sid in crawl_source_ids:
        candidate = parsed.get(sid)
        if not candidate:
            errors.append(f"No URL found for {sid}")
            continue
        url = candidate["url"]
        err = validate_public_https_url(url)
        if err:
            errors.append(f"{sid}: {err}")
            continue
        reach_err = await verify_url_reachable(client, url)
        if reach_err:
            errors.append(f"{sid}: {reach_err}")
            continue
        validated[sid] = candidate

    message = None
    if errors and not validated:
        message = "; ".join(errors)
    elif errors:
        message = "Partial results: " + "; ".join(errors)

    payload = {
        "urls": validated,
        "discover_available": True,
        "message": message,
        "receipt": receipt,
        "cached": False,
    }
    if validated:
        set_discovery(address, crawl_source_ids, {k: v for k, v in payload.items() if k != "cached"})
    return payload
