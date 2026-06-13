from __future__ import annotations

import httpx

from adapters import hazard_fetch
from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class OsmFootprintAdapter(BaseAdapter):
    source_id = "osm_footprint"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        lat, lng = ctx.geo["lat"], ctx.geo["lng"]
        data = await hazard_fetch.fetch_osm_building(client, lat, lng)
        if data.get("error"):
            return failed_result(self.source_id, data["error"])
        fields = [{"key": "osm_buildings", "value": data.get("summary"), "source": "osm", "confidence": "medium"}]
        if data.get("levels"):
            fields.append({"key": "osm_stories", "value": ", ".join(data["levels"]), "source": "osm", "confidence": "low"})
        return success_result(self.source_id, fields=fields)
