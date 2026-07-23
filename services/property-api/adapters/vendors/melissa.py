from __future__ import annotations

import os

import httpx

from adapters.base import api_key_configured, failed_result, skipped_result, success_result
from address_std import vendor_address
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class MelissaPropertyAdapter(BaseAdapter):
    source_id = "melissa_property"
    env_key = "MELISSA_LICENSE_KEY"
    api_url = "https://property.melissadata.net/v4/WEB/LookupProperty"

    async def validate(self, ctx: SourceContext) -> str | None:
        if not api_key_configured(self.source_id):
            return "Configure MELISSA_LICENSE_KEY"
        return None

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        key = os.environ.get(self.env_key, "").strip()
        std = vendor_address(ctx)
        lookup = str(std.get("full") or ctx.address).strip()
        try:
            r = await client.get(
                self.api_url,
                params={"id": key, "format": "json", "ff": lookup},
                timeout=25.0,
            )
            r.raise_for_status()
            data = r.json()
            records = data.get("Records") or []
            rec = records[0] if records else {}
            prop = rec.get("PropertyAddress") or {}
            primary = rec.get("PrimaryOwner") or {}
            mapped = {
                "yearBuilt": rec.get("YearBuilt"),
                "squareFootage": rec.get("AreaBuilding"),
                "propertyType": rec.get("PropertyUseGroup"),
                "constructionType": rec.get("Construction"),
                "ownerName": primary.get("Name1Full"),
                "assessedValue": rec.get("AssessedValueTotal"),
                "parcelNumber": prop.get("ParcelNumber"),
                "stories": rec.get("AreaStories") or rec.get("Stories"),
                "roofType": rec.get("RoofMaterial"),
                "zoning": rec.get("ZonedCodeLocal") or rec.get("PropertyUseStandardized"),
                "occupancyUse": rec.get("PropertyUseStandardized") or rec.get("PropertyUseGroup"),
            }
            return success_result(self.source_id, raw_data=mapped, source_bucket="melissa")
        except Exception as e:
            return failed_result(self.source_id, str(e))
