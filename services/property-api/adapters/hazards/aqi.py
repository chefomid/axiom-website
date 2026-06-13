from __future__ import annotations

import httpx

from adapters import hazard_fetch
from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class HazardAqiAdapter(BaseAdapter):
    source_id = "hazard_aqi"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        lat, lng = ctx.geo["lat"], ctx.geo["lng"]
        data = await hazard_fetch.fetch_aqi_openmeteo(client, lat, lng)
        if data.get("error"):
            return failed_result(self.source_id, data["error"])
        val = data.get("summary") or f"US AQI {data.get('us_aqi')}"
        fields = [{"key": "air_quality", "value": val, "source": "open_meteo", "confidence": "medium"}]
        return success_result(self.source_id, fields=fields, hazards={"aqi": data})
