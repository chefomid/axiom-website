"""SOV orchestrator adapter — post-process reconciliation."""

from __future__ import annotations

import httpx

from agents.sov_orchestrator.runner import run_sov_orchestrator
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class SovOrchestratorAdapter(BaseAdapter):
    source_id = "sov_orchestrator"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        vision_run = ctx.prior_results.get("vision_construction")
        vision_analysis = vision_run.analysis if vision_run and vision_run.analysis else None
        crawl_excerpt = kwargs.get("crawl_excerpt")
        return await run_sov_orchestrator(
            ctx,
            client,
            vision_analysis=vision_analysis,
            crawl_excerpt=crawl_excerpt,
        )
