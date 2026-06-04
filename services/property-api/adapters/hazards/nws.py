from __future__ import annotations

import httpx

from adapters import hazards as hazard_fetch
from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class HazardNwsAdapter(BaseAdapter):
    source_id = "hazard_nws"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        lat, lng = ctx.geo["lat"], ctx.geo["lng"]
        data = await hazard_fetch.fetch_nws_alerts(client, lat, lng)
        if data.get("error"):
            return failed_result(self.source_id, data["error"])
        fields = [{"key": "nws_alerts", "value": data.get("summary"), "source": "nws", "confidence": "high"}]
        return success_result(self.source_id, fields=fields, hazards={"nws": data})
