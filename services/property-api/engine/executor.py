"""Parallel source execution with cache and timeouts."""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import httpx

from address_std import apply_standardized_to_geo, standardize_address
from engine.adapter import SourceAdapter
from engine.cache import get_cache
from engine.models import SourceContext, SourceRunResult
from engine.normalize import observations_from_fields, result_with_observations
from engine.planner import ExecutionPlan, build_execution_plan
from engine.registry import get_adapter
from geocode import geocode_address
from registry_loader import get_source_by_id


def _ensure_standardized_geo(address: str, geo: dict[str, Any]) -> dict[str, Any]:
    if isinstance(geo.get("standardized"), dict) and geo["standardized"].get("full"):
        return geo
    std = standardize_address(input_address=address, geo=geo)
    return apply_standardized_to_geo(geo, std)


def _cache_address_key(ctx: SourceContext) -> str:
    std = ctx.address_std or (ctx.geo.get("standardized") if isinstance(ctx.geo, dict) else None) or {}
    full = str(std.get("full") or "").strip()
    return full or ctx.address


async def run_geocode(address: str) -> tuple[dict[str, Any] | None, SourceRunResult]:
    try:
        geo = await geocode_address(address.strip())
    except Exception as e:
        return None, SourceRunResult("geocode_census", status="failed", message=str(e), charged=False)
    if not geo:
        return None, SourceRunResult(
            "geocode_census",
            status="failed",
            message="Address could not be geocoded",
            charged=False,
        )
    geo = _ensure_standardized_geo(address.strip(), geo)
    std = geo.get("standardized") or {}
    source = geo.get("source")
    fields = [
        {"key": "property_address", "value": std.get("full") or geo.get("display_name"), "source": source, "confidence": "high"},
        {"key": "city", "value": std.get("city"), "source": source, "confidence": "high"},
        {"key": "state", "value": std.get("state"), "source": source, "confidence": "high"},
        {"key": "postcode", "value": std.get("postal_code"), "source": source, "confidence": "high"},
        {"key": "country", "value": std.get("country"), "source": source, "confidence": "high"},
    ]
    fields = [f for f in fields if f.get("value")]
    result = SourceRunResult("geocode_census", status="success", fields=fields)
    result.observations = observations_from_fields(fields, "geocode_census")
    return geo, result


def _execution_config(source_id: str) -> dict[str, Any]:
    src = get_source_by_id(source_id) or {}
    return src.get("execution") or {}


def merge_source_urls(
    *,
    source_urls: dict[str, str] | None = None,
    legacy_source_url: str | None = None,
    crawl_source_ids: list[str] | None = None,
) -> dict[str, str]:
    """Build per-source URL map; legacy URL fills missing crawl ids."""
    merged: dict[str, str] = {}
    for sid, url in (source_urls or {}).items():
        if url and str(url).strip():
            merged[sid] = str(url).strip()
    legacy = (legacy_source_url or "").strip()
    if legacy:
        for sid in crawl_source_ids or []:
            merged.setdefault(sid, legacy)
    return merged


def crawl_url_for_source(ctx: SourceContext, source_id: str) -> str | None:
    """Per-source URL map with legacy single source_url fallback."""
    url = (ctx.source_urls or {}).get(source_id)
    if url and str(url).strip():
        return str(url).strip()
    if ctx.source_url and str(ctx.source_url).strip():
        return str(ctx.source_url).strip()
    return None


def _default_validate(source_id: str, ctx: SourceContext) -> str | None:
    src = get_source_by_id(source_id)
    if not src:
        return "Unknown source"
    if src.get("requires_api_key"):
        env_key = src.get("env_key") or ""
        if not os.environ.get(env_key, "").strip():
            return f"API key not configured ({env_key})"
    if src.get("needs_source_url") and not crawl_url_for_source(ctx, source_id):
        return "Public source URL required"
    return None


async def _run_one_source(
    source_id: str,
    ctx: SourceContext,
    client: httpx.AsyncClient,
    *,
    crawl_fn=None,
    extract_fn=None,
    **adapter_kwargs: Any,
) -> SourceRunResult:
    adapter = get_adapter(source_id)
    exec_cfg = _execution_config(source_id)
    timeout_ms = exec_cfg.get("timeout_ms", 25000)
    ttl = exec_cfg.get("cache_ttl_seconds", 0)

    lat = ctx.geo["lat"]
    lng = ctx.geo["lng"]
    cache = get_cache()
    cache_address = _cache_address_key(ctx)
    cached = cache.get(source_id, lat, lng, cache_address, ttl)
    if cached:
        return cached

    skip_reason = _default_validate(source_id, ctx)
    if skip_reason:
        return SourceRunResult(source_id, status="skipped", message=skip_reason, charged=False)

    if not adapter:
        return SourceRunResult(source_id, status="skipped", message="No adapter registered", charged=False)

    adapter_skip = await adapter.validate(ctx)
    if adapter_skip:
        return SourceRunResult(source_id, status="skipped", message=adapter_skip, charged=False)

    start = time.monotonic()
    try:
        result = await asyncio.wait_for(
            adapter.fetch(
                ctx,
                client,
                crawl_fn=crawl_fn,
                extract_fn=extract_fn,
                **adapter_kwargs,
            ),
            timeout=timeout_ms / 1000.0,
        )
    except asyncio.TimeoutError:
        return SourceRunResult(
            source_id,
            status="failed",
            message=f"Timed out after {timeout_ms}ms",
            charged=False,
            latency_ms=timeout_ms,
        )
    except Exception as e:
        return SourceRunResult(
            source_id,
            status="failed",
            message=str(e),
            charged=False,
            latency_ms=int((time.monotonic() - start) * 1000),
        )

    result.latency_ms = int((time.monotonic() - start) * 1000)
    result = result_with_observations(result)
    if result.status == "success":
        cache.set(source_id, lat, lng, cache_address, ttl, result)
    return result


async def execute_plan(
    plan: ExecutionPlan,
    ctx: SourceContext,
    client: httpx.AsyncClient,
    *,
    crawl_fn=None,
    extract_fn=None,
    post_context: dict[str, Any] | None = None,
) -> list[SourceRunResult]:
    post_context = post_context or {}
    results: list[SourceRunResult] = []
    prior: dict[str, SourceRunResult] = {}

    for stage in plan.stages:
        tasks = [
            _run_one_source(
                sid,
                ctx,
                client,
                crawl_fn=crawl_fn,
                extract_fn=extract_fn,
            )
            for sid in stage.source_ids
        ]
        stage_results = await asyncio.gather(*tasks)
        for r in stage_results:
            prior[r.source_id] = r
            results.append(r)
        ctx.prior_results = prior

    from merger.trust import collect_observations_from_results
    ctx.all_observations = collect_observations_from_results(results)

    for source_id in plan.post_process:
        if source_id == "sov_orchestrator":
            r = await _run_one_source(
                source_id,
                ctx,
                client,
                crawl_fn=crawl_fn,
                extract_fn=extract_fn,
                crawl_excerpt=post_context.get("crawl_excerpt") if post_context else None,
            )
            results.append(r)
        else:
            results.append(
                SourceRunResult(
                    source_id,
                    status="success",
                    message="Applied in post-processing",
                    charged=True,
                )
            )

    return results


async def run_report(
    *,
    address: str,
    selected_sources: list[str],
    source_url: str | None = None,
    source_urls: dict[str, str] | None = None,
    crawl_fn=None,
    extract_fn=None,
    post_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any] | None, list[SourceRunResult]]:
    geo, geo_result = await run_geocode(address)
    if not geo:
        return None, [geo_result]

    plan = build_execution_plan(selected_sources)
    geo = _ensure_standardized_geo(address.strip(), geo)
    ctx = SourceContext(
        address=address.strip(),
        geo=geo,
        address_std=dict(geo.get("standardized") or {}),
        source_url=source_url,
        source_urls=dict(source_urls or {}),
    )
    headers = {"User-Agent": "AXIOM-PropertyIntelligence/0.3"}

    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        run_results = await execute_plan(
            plan,
            ctx,
            client,
            crawl_fn=crawl_fn,
            extract_fn=extract_fn,
            post_context=post_context,
        )

    return geo, [geo_result, *run_results]
