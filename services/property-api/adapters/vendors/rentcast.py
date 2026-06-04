from __future__ import annotations

import os

import httpx

from adapters.base import api_key_configured, failed_result, success_result, skipped_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class RentCastPropertyAdapter(BaseAdapter):
    source_id = "rentcast_property"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        key = os.environ.get("RENTCAST_API_KEY", "").strip()
        try:
            r = await client.get(
                "https://api.rentcast.io/v1/properties",
                params={"address": ctx.address},
                headers={"Accept": "application/json", "X-Api-Key": key},
                timeout=25.0,
            )
            if r.status_code == 404:
                return failed_result(self.source_id, "No RentCast record")
            r.raise_for_status()
            rows = r.json()
            row = rows[0] if isinstance(rows, list) and rows else rows if isinstance(rows, dict) else None
            if not row:
                return failed_result(self.source_id, "Empty RentCast response")
            return success_result(
                self.source_id,
                raw_data=row,
                source_bucket="rentcast",
            )
        except Exception as e:
            return failed_result(self.source_id, str(e))
