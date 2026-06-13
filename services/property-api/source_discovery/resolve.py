"""Auto-resolve crawl URLs before report execution."""

from __future__ import annotations

from typing import Any

import httpx

from source_discovery.discover import discover_source_urls
from source_discovery.jurisdiction import enrich_geo_with_jurisdiction, guess_public_portal_urls


async def auto_resolve_crawl_urls(
    *,
    address: str,
    geo: dict[str, Any],
    crawl_source_ids: list[str],
    existing_urls: dict[str, str],
    client: httpx.AsyncClient,
) -> tuple[dict[str, str], list[str]]:
    """
    Fill missing assessor/permit portal URLs automatically.
    Order: keep user URLs → AI discovery (lenient) → jurisdiction tables.
    """
    if not crawl_source_ids:
        return dict(existing_urls), []

    merged = {sid: url for sid, url in existing_urls.items() if url}
    warnings: list[str] = []
    geo_enriched = await enrich_geo_with_jurisdiction(client, geo)

    missing = [sid for sid in crawl_source_ids if not merged.get(sid)]
    if missing:
        discovery = await discover_source_urls(
            address=address,
            display_name=geo_enriched.get("display_name"),
            geo=geo_enriched,
            crawl_source_ids=missing,
            client=client,
            strict_reachability=False,
        )
        warnings.extend(discovery.get("warnings") or [])
        for sid, item in (discovery.get("urls") or {}).items():
            if item.get("url"):
                merged[sid] = str(item["url"])

    still_missing = [sid for sid in crawl_source_ids if not merged.get(sid)]
    if still_missing:
        guessed = guess_public_portal_urls(geo_enriched, still_missing)
        for sid, item in guessed.items():
            if item.get("url"):
                merged[sid] = str(item["url"])
                warnings.append(f"Using jurisdiction portal for {_source_label(sid)}.")

    return merged, warnings


def _source_label(source_id: str) -> str:
    labels = {
        "assessor_crawl": "county assessor page",
        "permit_crawl": "permit portal",
    }
    return labels.get(source_id, source_id.replace("_", " "))
