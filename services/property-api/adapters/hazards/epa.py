from __future__ import annotations

import httpx

from adapters import hazard_fetch
from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class HazardEpaAdapter(BaseAdapter):
    source_id = "hazard_epa"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        lat, lng = ctx.geo["lat"], ctx.geo["lng"]
        data = await hazard_fetch.fetch_epa_echo(client, lat, lng)
        if data.get("error"):
            return failed_result(self.source_id, data["error"])
        fields = []
        if data.get("summary"):
            fields.append(
                {
                    "key": "environmental_facilities",
                    "value": data["summary"],
                    "source": "epa_echo",
                    "confidence": "high",
                }
            )
        return success_result(self.source_id, fields=fields, hazards={"epa": data})
