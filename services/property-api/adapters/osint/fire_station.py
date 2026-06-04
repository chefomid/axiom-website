from __future__ import annotations

import httpx

from adapters import osint as osint_fetch
from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class FireStationAdapter(BaseAdapter):
    source_id = "fire_station_gis"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        lat, lng = ctx.geo["lat"], ctx.geo["lng"]
        data = await osint_fetch.fetch_fire_station_distance(client, lat, lng)
        if data.get("error"):
            return failed_result(self.source_id, data["error"])
        fields = [{"key": "fire_station_distance", "value": data.get("summary"), "source": "fire_station_gis", "confidence": "medium"}]
        return success_result(self.source_id, fields=fields)
