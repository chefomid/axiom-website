from __future__ import annotations

import httpx

from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class PostProcessAdapter(BaseAdapter):
    def __init__(self, source_id: str):
        self.source_id = source_id

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        return SourceRunResult(
            self.source_id,
            status="success",
            message="Applied in post-processing",
            charged=True,
        )
