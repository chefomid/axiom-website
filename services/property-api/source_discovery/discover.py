"""Discover public assessor / permit portal URLs via OpenAI web search."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from llm.openai_client import format_openai_http_error, openai_api_key, responses_with_web_search
from registry_loader import get_margin_multiplier, get_source_by_id
from source_discovery.cache import get_discovery, set_discovery
from source_discovery.url_validate import validate_public_https_url, verify_url_reachable

SOURCE_LABELS: dict[str, str] = {
    "assessor_crawl": "County assessor page",
    "permit_crawl": "Permit portal",
}

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


def _source_label(source_id: str) -> str:
    src = get_source_by_id(source_id) or {}
    return SOURCE_LABELS.get(source_id) or src.get("label") or source_id.replace("_", " ")


def _humanize_discovery_issue(source_id: str, detail: str) -> str:
    label = _source_label(source_id)
    lowered = detail.lower()
    if detail.startswith("No URL found"):
        return f"Couldn't find a {label.lower()} for this address."
    if "url is empty" in lowered or "invalid url" in lowered:
        return f"{label}: Link was invalid."
    if "must use https" in lowered:
        return f"{label}: Only secure HTTPS links are accepted."
    return f"{label}: {detail}"


def discovery_receipt() -> dict[str, float]:
    """Preview discovery is complimentary; OpenAI cost is covered in report aggregation."""
    return {
        "api_cost_usd": 0.0,
        "service_cost_usd": 0.0,
        "loaded_cost_usd": 0.0,
        "margin_multiplier": get_margin_multiplier(),
        "user_price_usd": 0.0,
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
    strict_reachability: bool = True,
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
            "warnings": [],
            "receipt": receipt,
            "cached": False,
        }

    if not api_key:
        return {
            "urls": {},
            "discover_available": False,
            "message": "AI discovery unavailable — add OPENAI_API_KEY to server .env",
            "warnings": [],
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
        return {
            "urls": {},
            "discover_available": True,
            "message": format_openai_http_error(e, context="AI discovery"),
            "warnings": [],
            "receipt": receipt,
            "cached": False,
        }
    except Exception as e:
        return {
            "urls": {},
            "discover_available": True,
            "message": f"AI discovery failed: {e}",
            "warnings": [],
            "receipt": receipt,
            "cached": False,
        }

    parsed = _parse_discovery_json(raw_text)
    validated: dict[str, dict[str, Any]] = {}
    errors: list[str] = []

    for sid in crawl_source_ids:
        candidate = parsed.get(sid)
        if not candidate:
            errors.append(_humanize_discovery_issue(sid, f"No URL found for {sid}"))
            continue
        url = candidate["url"]
        err = validate_public_https_url(url)
        if err:
            errors.append(_humanize_discovery_issue(sid, err))
            continue
        reach_err = None
        if strict_reachability:
            reach_err = await verify_url_reachable(client, url)
            if reach_err:
                errors.append(_humanize_discovery_issue(sid, reach_err))
                continue
        else:
            reach_err = await verify_url_reachable(client, url)
            if reach_err:
                candidate = {
                    **candidate,
                    "confidence": "low",
                    "reason": reach_err,
                }
                errors.append(_humanize_discovery_issue(sid, reach_err))
        validated[sid] = candidate

    warnings = list(errors)
    message = None
    if errors and not validated:
        message = (
            warnings[0]
            if len(warnings) == 1
            else "Couldn't verify public record pages for this address."
        )
    elif errors:
        filled = len(validated)
        total = len(crawl_source_ids)
        message = f"Resolved {filled} of {total} public record pages automatically."

    payload = {
        "urls": validated,
        "discover_available": True,
        "message": message,
        "warnings": warnings,
        "receipt": receipt,
        "cached": False,
    }
    if validated:
        set_discovery(address, crawl_source_ids, {k: v for k, v in payload.items() if k != "cached"})
    return payload
