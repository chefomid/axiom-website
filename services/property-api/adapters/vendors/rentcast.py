from __future__ import annotations

import os
from typing import Any

import httpx

from adapters.base import api_key_configured, failed_result, skipped_result, success_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


def _latest_tax_assessment(tax_assessments: dict[str, Any] | None) -> int | None:
    if not tax_assessments or not isinstance(tax_assessments, dict):
        return None
    best_year = None
    best_value = None
    for year_key, entry in tax_assessments.items():
        if not isinstance(entry, dict):
            continue
        try:
            year = int(entry.get("year") or year_key)
        except (TypeError, ValueError):
            continue
        value = entry.get("value")
        if value is None:
            continue
        try:
            numeric = int(float(value))
        except (TypeError, ValueError):
            continue
        if best_year is None or year > best_year:
            best_year = year
            best_value = numeric
    return best_value


def _shape_rentcast_row(row: dict[str, Any]) -> dict[str, Any]:
    """Flatten nested RentCast JSON for YAML field mapping."""
    owner = row.get("owner") or {}
    names = owner.get("names") or []
    features = row.get("features") or {}
    shaped = dict(row)
    if names:
        shaped["ownerName"] = names[0] if isinstance(names, list) else names
    assessed = _latest_tax_assessment(row.get("taxAssessments"))
    if assessed is not None:
        shaped["assessedValue"] = assessed
    if features.get("roofType"):
        shaped["roofType"] = features.get("roofType")
    return shaped


class RentCastPropertyAdapter(BaseAdapter):
    source_id = "rentcast_property"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        if not api_key_configured(self.source_id):
            return skipped_result(self.source_id, "RENTCAST_API_KEY not configured")
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
            mapped = _shape_rentcast_row(row)
            supplemental = []
            if row.get("bedrooms") is not None:
                supplemental.append(
                    {
                        "key": "bedrooms",
                        "value": str(row["bedrooms"]),
                        "source": "rentcast",
                        "confidence": "high",
                    }
                )
            if row.get("bathrooms") is not None:
                supplemental.append(
                    {
                        "key": "bathrooms",
                        "value": str(row["bathrooms"]),
                        "source": "rentcast",
                        "confidence": "high",
                    }
                )
            if row.get("lastSaleDate"):
                supplemental.append(
                    {
                        "key": "last_sale_date",
                        "value": str(row["lastSaleDate"])[:10],
                        "source": "rentcast",
                        "confidence": "high",
                    }
                )
            if row.get("lastSalePrice") is not None:
                supplemental.append(
                    {
                        "key": "last_sale_price",
                        "value": f"${int(row['lastSalePrice']):,}",
                        "source": "rentcast",
                        "confidence": "high",
                    }
                )
            result = success_result(
                self.source_id,
                raw_data=mapped,
                source_bucket="rentcast",
            )
            if supplemental:
                result.fields = supplemental
            return result
        except Exception as e:
            return failed_result(self.source_id, str(e))
