from __future__ import annotations

import httpx

from adapters.base import skipped_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class HazardEpaAdapter(BaseAdapter):
    source_id = "hazard_epa"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        return skipped_result(self.source_id, "EPA ECHO adapter — enable in next release")
