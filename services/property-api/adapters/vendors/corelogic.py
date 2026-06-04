from __future__ import annotations

import httpx

from adapters.base import api_key_configured, skipped_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class CoreLogicPropertyAdapter(BaseAdapter):
    source_id = "corelogic_property"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        if not api_key_configured(self.source_id):
            return skipped_result(self.source_id, "Configure CORELOGIC_API_KEY — industry-standard data carriers recognize.")
        return skipped_result(self.source_id, "CoreLogic subject property — wire to your Cotality endpoint when available")


class CoreLogicSpatialAdapter(BaseAdapter):
    source_id = "corelogic_spatial"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        if not api_key_configured(self.source_id):
            return skipped_result(self.source_id, "Configure CORELOGIC_API_KEY — defensible flood and peril layers.")
        return skipped_result(self.source_id, "CoreLogic spatial hazard — wire to your Cotality endpoint when available")
