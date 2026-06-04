from __future__ import annotations

import os

import httpx

from adapters.base import api_key_configured, failed_result, skipped_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class RegridParcelAdapter(BaseAdapter):
    source_id = "regrid_parcel"
    env_key = "REGRID_API_KEY"
    api_url = "https://app.regrid.com/api/v2/parcels/point"

    async def validate(self, ctx: SourceContext) -> str | None:
        if not api_key_configured(self.source_id):
            return "Configure REGRID_API_KEY"
        return None

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        key = os.environ.get(self.env_key, "").strip()
        try:
            r = await client.get(
                self.api_url,
                params={"lat": ctx.geo["lat"], "lon": ctx.geo["lng"], "token": key},
                timeout=25.0,
            )
            r.raise_for_status()
            data = r.json()
            features = ((data.get("parcels") or {}).get("features") or [])
            feat = features[0] if features else {}
            props = feat.get("properties") or {}
            fields_data = props.get("fields") or props
            mapped = {
                "parcelNumber": fields_data.get("parcelnumb") or fields_data.get("pin"),
                "ownerName": fields_data.get("owner"),
                "zoning": fields_data.get("zoning"),
                "assessedValue": fields_data.get("parval"),
                "squareFootage": fields_data.get("sqft") or fields_data.get("ll_gissqft"),
            }
            return success_result(self.source_id, raw_data=mapped, source_bucket="regrid")
        except Exception as e:
            return failed_result(self.source_id, str(e))
