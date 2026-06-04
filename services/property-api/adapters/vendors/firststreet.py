from __future__ import annotations

import os

import httpx

from adapters.base import api_key_configured, failed_result, skipped_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class FirstStreetAdapter(BaseAdapter):
    source_id = "firststreet_risk"
    env_key = "FIRSTSTREET_API_KEY"
    api_url = "https://api.firststreet.org/v2/property"

    async def validate(self, ctx: SourceContext) -> str | None:
        if not api_key_configured(self.source_id):
            return "Configure FIRSTSTREET_API_KEY"
        return None

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        key = os.environ.get(self.env_key, "").strip()
        try:
            r = await client.get(
                self.api_url,
                params={"lat": ctx.geo["lat"], "lng": ctx.geo["lng"]},
                headers={"Accept": "application/json", "Authorization": f"Bearer {key}"},
                timeout=25.0,
            )
            r.raise_for_status()
            data = r.json()
            mapped = {
                "floodSummary": data.get("flood", {}).get("score") if isinstance(data.get("flood"), dict) else data.get("flood_score"),
                "wildfireSummary": data.get("fire", {}).get("score") if isinstance(data.get("fire"), dict) else data.get("fire_score"),
            }
            fields = []
            if mapped.get("floodSummary"):
                fields.append({"key": "flood_summary", "value": f"First Street flood score {mapped['floodSummary']}", "source": "firststreet", "confidence": "high"})
            if mapped.get("wildfireSummary"):
                fields.append({"key": "wildfire_summary", "value": f"First Street fire score {mapped['wildfireSummary']}", "source": "firststreet", "confidence": "high"})
            return success_result(self.source_id, fields=fields, raw_data=mapped, source_bucket="firststreet")
        except Exception as e:
            return failed_result(self.source_id, str(e))
