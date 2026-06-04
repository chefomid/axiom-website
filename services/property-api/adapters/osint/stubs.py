from __future__ import annotations

import httpx

from adapters.base import skipped_result
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult


class OpenAddressesStubAdapter(BaseAdapter):
    source_id = "openaddresses_lookup"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        return skipped_result(
            self.source_id,
            "County auto-discovery — configure county adapter or use assessor crawl URL",
        )


class CountyParcelStubAdapter(BaseAdapter):
    source_id = "county_parcel_arcgis"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        return skipped_result(
            self.source_id,
            "County auto-discovery — configure county adapter or use assessor crawl URL",
        )
