"""ATTOM property and hazard adapters."""

from __future__ import annotations

import os
from typing import Any

import httpx

from adapters.base import api_key_configured, failed_result, skipped_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class AttomPropertyAdapter(BaseAdapter):
    source_id = "attom_property"
    env_key = "ATTOM_API_KEY"
    api_url = "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail"

    async def validate(self, ctx: SourceContext) -> str | None:
        if not api_key_configured(self.source_id):
            return "Configure ATTOM_API_KEY — construction, stories, roof, and occupancy use code."
        return None

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        key = os.environ.get(self.env_key, "").strip()
        addr = ctx.geo.get("address") or {}
        params: dict[str, Any] = {
            "address1": ctx.address.split(",")[0].strip(),
            "address2": f"{addr.get('city', '')}, {addr.get('state', '')} {addr.get('postcode') or addr.get('zip', '')}".strip(", "),
        }
        try:
            r = await client.get(
                self.api_url,
                params=params,
                headers={"Accept": "application/json", "apikey": key},
                timeout=25.0,
            )
            if r.status_code == 404:
                return failed_result(self.source_id, "No ATTOM record")
            r.raise_for_status()
            data = r.json()
            prop = (data.get("property") or [{}])[0] if isinstance(data.get("property"), list) else data.get("property") or data
            building = prop.get("building") or {}
            summary = prop.get("summary") or {}
            lot = prop.get("lot") or {}
            mapped = {
                "yearBuilt": summary.get("yearbuilt") or building.get("construction", {}).get("yearBuilt"),
                "squareFootage": building.get("size", {}).get("livingsize") or building.get("size", {}).get("universalsize"),
                "stories": building.get("summary", {}).get("levels"),
                "constructionType": building.get("construction", {}).get("constructiontype"),
                "roofType": building.get("construction", {}).get("roofcover"),
                "propertyType": summary.get("propclass") or summary.get("proptype"),
                "ownerName": (prop.get("owner") or {}).get("owner1", {}).get("fullname"),
                "occupancyUse": summary.get("propertyType"),
                "parcelNumber": lot.get("lotnum") or lot.get("apn"),
            }
            return success_result(self.source_id, raw_data=mapped, source_bucket="attom")
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (401, 403):
                return skipped_result(self.source_id, "ATTOM API key rejected")
            return failed_result(self.source_id, str(e))
        except Exception as e:
            return failed_result(self.source_id, str(e))


class AttomHazardAdapter(BaseAdapter):
    source_id = "attom_hazard"
    env_key = "ATTOM_API_KEY"
    api_url = "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail"

    async def validate(self, ctx: SourceContext) -> str | None:
        if not api_key_configured(self.source_id):
            return "Configure ATTOM_API_KEY for hazard scores"
        prior = ctx.prior_results.get("attom_property")
        if prior and prior.status != "success":
            return "ATTOM property must succeed before hazard layer"
        return None

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        key = os.environ.get(self.env_key, "").strip()
        addr = ctx.geo.get("address") or {}
        params = {
            "address1": ctx.address.split(",")[0].strip(),
            "address2": f"{addr.get('city', '')}, {addr.get('state', '')} {addr.get('postcode') or addr.get('zip', '')}".strip(", "),
        }
        try:
            r = await client.get(
                self.api_url,
                params=params,
                headers={"Accept": "application/json", "apikey": key},
                timeout=25.0,
            )
            r.raise_for_status()
            data = r.json()
            prop = (data.get("property") or [{}])[0] if isinstance(data.get("property"), list) else data.get("property") or {}
            hazard = prop.get("hazard") or prop.get("assessment") or {}
            mapped = {
                "floodZone": hazard.get("flood", {}).get("zone") if isinstance(hazard.get("flood"), dict) else hazard.get("floodZone"),
                "floodSummary": hazard.get("flood", {}).get("description") if isinstance(hazard.get("flood"), dict) else None,
                "wildfireSummary": hazard.get("wildfire", {}).get("risk") if isinstance(hazard.get("wildfire"), dict) else hazard.get("wildfireRisk"),
            }
            fields = []
            if mapped.get("floodZone"):
                fields.append({"key": "flood_zone", "value": str(mapped["floodZone"]), "source": "attom_hazard", "confidence": "high"})
            if mapped.get("floodSummary"):
                fields.append({"key": "flood_summary", "value": str(mapped["floodSummary"]), "source": "attom_hazard", "confidence": "high"})
            if mapped.get("wildfireSummary"):
                fields.append({"key": "wildfire_summary", "value": str(mapped["wildfireSummary"]), "source": "attom_hazard", "confidence": "high"})
            return success_result(self.source_id, fields=fields, raw_data=mapped, source_bucket="attom_hazard")
        except Exception as e:
            return failed_result(self.source_id, str(e))
