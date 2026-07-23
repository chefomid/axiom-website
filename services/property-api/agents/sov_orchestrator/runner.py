"""SOV orchestrator — reconcile vendor, online, and visual AI lanes."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import httpx

from agents.sov_orchestrator.apply import apply_orchestrator_result
from agents.sov_orchestrator.digest import render_sov_digest
from agents.sov_orchestrator.lanes import (
    build_evidence_lanes,
    critical_sov_field_ids,
    lane_disagreement_on_field,
    sov_field_ids,
)
from agents.sov_orchestrator.schema import (
    build_pass_through_result,
    normalize_orchestrator_response,
    parse_reconcile_json,
)
from engine.models import Observation, SourceContext, SourceRunResult, TrustedValue
from llm.openai_client import DEFAULT_CHAT_MODEL, chat_completion, format_openai_http_error, openai_api_key
from merger.trust import resolve_all

SOURCE_ID = "sov_orchestrator"
AGENT_VERSION = 1
_PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "reconcile.md"

VISUAL_VENDOR_FIELDS = frozenset({"stories", "construction_type", "iso_construction_class", "roof_type"})


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8").strip()


def _sov_completeness_pct(trusted: dict[str, TrustedValue]) -> int:
    ids = sov_field_ids()
    if not ids:
        return 0
    observed = sum(
        1
        for fid in ids
        if trusted.get(fid) and trusted[fid].status == "observed" and trusted[fid].value
    )
    return round((observed / len(ids)) * 100)


def _should_run_llm(lanes: dict[str, Any], trusted: dict[str, TrustedValue], conflicts: list[dict]) -> tuple[bool, str]:
    if lanes.get("lanes_with_data", 0) < 2:
        return False, "fewer_than_two_lanes"

    sov_conflicts = [c for c in conflicts if c.get("field_id") in sov_field_ids()]
    if sov_conflicts:
        return True, "sov_conflicts"

    for field_id in VISUAL_VENDOR_FIELDS:
        if lane_disagreement_on_field(lanes, field_id):
            return True, f"lane_disagreement_{field_id}"

    critical = critical_sov_field_ids()
    missing_critical = [
        fid
        for fid in critical
        if not (trusted.get(fid) and trusted[fid].status == "observed" and trusted[fid].value)
    ]
    if missing_critical and lanes.get("lanes_with_data", 0) >= 2:
        return True, "critical_gaps"

    return False, "deterministic_complete"


async def _llm_reconcile(
    *,
    client: httpx.AsyncClient,
    api_key: str,
    address: str,
    lat: float,
    lng: float,
    lanes: dict[str, Any],
) -> dict[str, Any]:
    payload = {
        "address": address,
        "coordinates": [lat, lng],
        "lanes": {
            "vendor_api": lanes.get("vendor_api"),
            "online_public": lanes.get("online_public"),
            "visual_ai": lanes.get("visual_ai"),
        },
        "deterministic_baseline": lanes.get("deterministic_baseline"),
        "conflicts": list((lanes.get("conflicts") or {}).values()),
    }
    user_content = (
        f"Property: {address}\n"
        f"Coordinates: {lat}, {lng}\n\n"
        f"Evidence bundle:\n{json.dumps(payload, indent=2, default=str)}"
    )
    raw = await chat_completion(
        client=client,
        api_key=api_key,
        messages=[
            {"role": "system", "content": _load_prompt()},
            {"role": "user", "content": user_content},
        ],
        model=DEFAULT_CHAT_MODEL,
        timeout=60.0,
    )
    return normalize_orchestrator_response(parse_reconcile_json(raw))


async def run_sov_orchestrator(
    ctx: SourceContext,
    client: httpx.AsyncClient,
    *,
    observations: list[Observation] | None = None,
    vision_analysis: dict[str, Any] | None = None,
    crawl_excerpt: str | None = None,
    prior_results: dict[str, Any] | None = None,
) -> SourceRunResult:
    obs = observations if observations is not None else ctx.all_observations
    if not obs:
        return SourceRunResult(
            SOURCE_ID,
            status="skipped",
            message="No observations to reconcile",
            charged=False,
        )

    trusted, conflicts = resolve_all(obs)
    prior = prior_results or ctx.prior_results or {}
    web_run = prior.get("web_property_research")

    lanes = build_evidence_lanes(
        obs,
        vision_analysis=vision_analysis,
        web_research_run=web_run,
        crawl_excerpt=crawl_excerpt,
        trusted=trusted,
        conflicts=conflicts,
    )

    agent_trace: dict[str, Any] = {
        "agent_version": AGENT_VERSION,
        "lanes_with_data": lanes.get("lanes_with_data"),
        "phases": [],
    }

    run_llm, skip_reason = _should_run_llm(lanes, trusted, conflicts)
    api_key = openai_api_key()

    from address_std import vendor_address

    std = vendor_address(ctx)
    address = std.get("full") or ctx.geo.get("display_name") or ctx.address
    lat = float(ctx.geo.get("lat") or 0)
    lng = float(ctx.geo.get("lng") or 0)

    if run_llm and not api_key:
        run_llm = False
        skip_reason = "openai_key_missing"

    if run_llm:
        t0 = time.monotonic()
        try:
            result = await _llm_reconcile(
                client=client,
                api_key=api_key,
                address=address,
                lat=lat,
                lng=lng,
                lanes=lanes,
            )
        except httpx.HTTPStatusError as e:
            return SourceRunResult(
                SOURCE_ID,
                status="failed",
                message=format_openai_http_error(e, context="SOV orchestrator"),
                charged=False,
            )
        except Exception as e:
            return SourceRunResult(
                SOURCE_ID,
                status="failed",
                message=f"SOV orchestrator failed: {e}",
                charged=False,
            )
        agent_trace["phases"].append(
            {
                "name": "reconcile",
                "latency_ms": int((time.monotonic() - t0) * 1000),
                "detail": f"LLM reconciliation ({DEFAULT_CHAT_MODEL})",
            }
        )
        agent_trace["model"] = DEFAULT_CHAT_MODEL
    else:
        result = build_pass_through_result(
            {fid: trusted[fid] for fid in sov_field_ids() if fid in trusted},
            summary="Deterministic SOV from source precedence — no multi-lane reconciliation needed.",
        )
        agent_trace["skip_reason"] = skip_reason

    adjusted, remaining_conflicts = apply_orchestrator_result(
        trusted,
        result,
        original_conflicts=conflicts,
    )

    completeness = _sov_completeness_pct(adjusted)
    sov_digest_md = render_sov_digest(
        address=address,
        lat=lat,
        lng=lng,
        result=result,
        lanes=lanes,
        completeness_pct=completeness,
    )

    analysis = {
        "statement_of_values": result.get("statement_of_values") or {},
        "sov_digest_md": sov_digest_md,
        "discrepancies": result.get("discrepancies") or [],
        "enrichments": result.get("enrichments") or [],
        "underwriter_notes": result.get("underwriter_notes") or [],
        "summary": result.get("summary"),
        "agent_trace": agent_trace,
        "agent_version": AGENT_VERSION,
    }

    msg = result.get("summary") or (
        f"SOV orchestrator reconciled {len(result.get('discrepancies') or [])} discrepancy(ies)"
        if run_llm
        else "Deterministic SOV applied"
    )

    return SourceRunResult(
        SOURCE_ID,
        status="success",
        message=msg,
        charged=run_llm,
        trusted_values=adjusted,
        conflicts_override=remaining_conflicts,
        analysis=analysis,
    )
