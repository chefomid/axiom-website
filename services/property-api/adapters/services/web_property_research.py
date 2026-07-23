"""OpenAI web search for public property intelligence beyond vendor APIs."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from adapters.base import api_key_configured, failed_result, skipped_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult
from llm.openai_client import format_openai_http_error, openai_api_key, responses_with_web_search

INSTRUCTIONS = """You research US properties for insurance COPE underwriting.
Use web search to find publicly available facts from assessor records, county GIS,
building permits, reputable listing sites, and news. Prefer official .gov sources.
Only include values you can support with a real public page. Do not invent data.
Reply with JSON only, no markdown fences:
{
  "yearBuilt": "1985",
  "squareFootage": "2400",
  "stories": "2",
  "constructionType": "frame",
  "roofType": "composition shingle",
  "propertyType": "single family",
  "ownerName": "...",
  "occupancyUse": "owner occupied",
  "parcelNumber": "...",
  "zoning": "R-1",
  "assessedValue": "450000",
  "citations": [
    {"field": "yearBuilt", "url": "https://...", "note": "county assessor parcel page"}
  ],
  "summary": "2-3 sentences on what public sources confirm for this address"
}
Omit keys you cannot verify from public sources."""

WEB_SEARCH_API_COST_USD = 0.04


class WebPropertyResearchAdapter(BaseAdapter):
    source_id = "web_property_research"

    async def validate(self, ctx: SourceContext) -> str | None:
        if not api_key_configured(self.source_id):
            return "Configure OPENAI_API_KEY for AI web property research"
        return None

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        api_key = openai_api_key()
        if not api_key:
            return skipped_result(self.source_id, "OPENAI_API_KEY not configured")

        from address_std import vendor_address

        std = vendor_address(ctx)
        addr = ctx.geo.get("address") or {}
        location_line = str(std.get("full") or ctx.geo.get("display_name") or ctx.address or "")
        if addr.get("county"):
            location_line = f"{location_line}, {addr.get('county')}" if location_line else str(addr.get("county"))

        user_input = (
            f"Property address: {location_line}\n"
            f"Coordinates: {ctx.geo.get('lat')}, {ctx.geo.get('lng')}\n\n"
            "Search the public web for COPE-relevant property characteristics "
            "(construction, occupancy, protection hints, parcel ID, year built, sqft)."
        )

        try:
            raw_text = await responses_with_web_search(
                client=client,
                api_key=api_key,
                instructions=INSTRUCTIONS,
                user_input=user_input,
                timeout=90.0,
            )
        except httpx.HTTPStatusError as e:
            return failed_result(
                self.source_id,
                format_openai_http_error(e, context="Web property search"),
            )
        except Exception as e:
            return failed_result(self.source_id, f"Web search failed: {e}")

        parsed = _parse_research_json(raw_text)
        if not parsed:
            return failed_result(self.source_id, "Could not parse web research response")

        mapped = {k: v for k, v in parsed.items() if k not in ("citations", "summary") and v}
        if not mapped:
            summary = parsed.get("summary") or "No verifiable public property data found"
            return SourceRunResult(
                self.source_id,
                status="success",
                message=summary,
                charged=True,
            )

        summary = parsed.get("summary") or ""
        citations = parsed.get("citations") or []
        cite_note = _format_citations(citations)
        message = " · ".join(x for x in [summary, cite_note] if x)

        return success_result(
            self.source_id,
            raw_data=mapped,
            source_bucket="web_search",
            message=message or None,
        )


def _parse_research_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _format_citations(citations: list[Any]) -> str:
    urls: list[str] = []
    for item in citations[:5]:
        if isinstance(item, dict) and item.get("url"):
            urls.append(str(item["url"]))
    if not urls:
        return ""
    return "Sources: " + ", ".join(urls)
