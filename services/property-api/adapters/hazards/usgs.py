from __future__ import annotations

import httpx

from adapters import hazard_fetch
from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class HazardUsgsAdapter(BaseAdapter):
    source_id = "hazard_usgs"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        lat, lng = ctx.geo["lat"], ctx.geo["lng"]
        data = await hazard_fetch.fetch_usgs_seismic(client, lat, lng)
        if data.get("error"):
            return failed_result(self.source_id, data["error"])
        fields = [{"key": "seismic_summary", "value": data.get("summary"), "source": "usgs", "confidence": "high"}]
        return success_result(self.source_id, fields=fields, hazards={"usgs": data})
