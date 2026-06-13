from __future__ import annotations

import httpx

from adapters import hazard_fetch
from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class HazardWildfireAdapter(BaseAdapter):
    source_id = "hazard_wildfire"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        lat, lng = ctx.geo["lat"], ctx.geo["lng"]
        data = await hazard_fetch.fetch_wildfire_eonet(client, lat, lng)
        if data.get("error"):
            return failed_result(self.source_id, data["error"])
        fields = [{"key": "wildfire_summary", "value": data.get("summary"), "source": "nasa_eonet", "confidence": "medium"}]
        return success_result(self.source_id, fields=fields, hazards={"wildfire": data})
