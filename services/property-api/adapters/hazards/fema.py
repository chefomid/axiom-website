from __future__ import annotations

import httpx

from adapters import hazard_fetch
from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class HazardFemaAdapter(BaseAdapter):
    source_id = "hazard_fema"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        lat, lng = ctx.geo["lat"], ctx.geo["lng"]
        data = await hazard_fetch.fetch_fema_flood(client, lat, lng)
        if data.get("error"):
            return failed_result(self.source_id, data["error"])
        fields = []
        if data.get("zone"):
            fields.append({"key": "flood_zone", "value": str(data["zone"]), "source": "fema_nfhl", "confidence": "high"})
        if data.get("summary"):
            fields.append({"key": "flood_summary", "value": data["summary"], "source": "fema_nfhl", "confidence": "high"})
        return success_result(self.source_id, fields=fields, hazards={"fema": data})
