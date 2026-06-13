"""LLM-assisted conflict resolution for semantic field disagreements.

DEPRECATED: Replaced by agents/sov_orchestrator (sov_orchestrator source).
"""

from __future__ import annotations

import json
import os
import re

import httpx

from engine.adapter import BaseAdapter
from llm.openai_client import chat_completion
from engine.models import SourceContext, SourceRunResult, TrustedValue
from merger.trust import resolve_all


class LlmConflictResolveAdapter(BaseAdapter):
    source_id = "llm_conflict_resolve"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        if not ctx.all_observations:
            return SourceRunResult(
                self.source_id,
                status="skipped",
                message="No observations to reconcile",
                charged=False,
            )

        trusted, conflicts = resolve_all(ctx.all_observations)
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()

        if not conflicts or not api_key:
            ctx.trusted_values = trusted
            return SourceRunResult(
                self.source_id,
                status="success",
                message="Deterministic resolution applied" if not api_key else "No material conflicts",
                charged=bool(api_key and conflicts),
                trusted_values=trusted,
                conflicts_override=[] if not conflicts else conflicts,
            )

        adjusted = await _llm_resolve(conflicts, trusted, client, api_key)
        ctx.trusted_values = adjusted
        remaining_conflicts = [c for c in conflicts if c.get("field_id") not in adjusted or adjusted[c["field_id"]].conflict]

        return SourceRunResult(
            self.source_id,
            status="success",
            message=f"LLM reconciled {len(adjusted)} field(s)",
            charged=True,
            trusted_values=adjusted,
            conflicts_override=remaining_conflicts,
        )


async def _llm_resolve(
    conflicts: list[dict],
    trusted: dict[str, TrustedValue],
    client: httpx.AsyncClient,
    api_key: str,
) -> dict[str, TrustedValue]:
    adjusted = dict(trusted)
    for conflict in conflicts[:5]:
        field_id = conflict["field_id"]
        alts = conflict.get("alternatives") or []
        prompt = (
            f"Field: {field_id}\n"
            f"Alternatives: {json.dumps(alts)}\n"
            "Pick the most accurate value for insurance COPE underwriting. "
            'Reply JSON only: {"value":"...","source":"...","reason":"..."}'
        )
        try:
            content = await chat_completion(
                client=client,
                api_key=api_key,
                messages=[{"role": "user", "content": prompt}],
            )
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if not match:
                continue
            parsed = json.loads(match.group())
            if parsed.get("value"):
                adjusted[field_id] = TrustedValue(
                    field_id=field_id,
                    value=str(parsed["value"]),
                    display_value=str(parsed["value"]),
                    source=parsed.get("source") or "llm",
                    confidence="medium",
                    method="llm",
                    status="observed",
                    alternatives=alts,
                    conflict=False,
                )
        except Exception:
            continue
    return adjusted
