from __future__ import annotations

import httpx

from adapters.base import failed_result, success_result
from engine.adapter import BaseAdapter
from engine.executor import crawl_url_for_source
from engine.models import SourceContext, SourceRunResult


class AssessorCrawlAdapter(BaseAdapter):
    source_id = "assessor_crawl"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, *, crawl_fn=None, extract_fn=None, **kwargs) -> SourceRunResult:
        url = crawl_url_for_source(ctx, self.source_id)
        if not crawl_fn or not url:
            return failed_result(self.source_id, "Crawl URL required")
        excerpt, meta = await crawl_fn(url)
        if not excerpt:
            return failed_result(self.source_id, meta or "Crawl failed")
        fields = extract_fn(excerpt) if extract_fn else []
        fields = [
            {"key": f["key"], "value": f["value"], "source": f.get("source", "assessor_crawl"), "confidence": f.get("confidence", "low")}
            for f in fields
        ]
        return success_result(self.source_id, fields=fields, message=f"Crawled {url}")


class PermitCrawlAdapter(BaseAdapter):
    source_id = "permit_crawl"

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, *, crawl_fn=None, extract_fn=None, **kwargs) -> SourceRunResult:
        url = crawl_url_for_source(ctx, self.source_id)
        if not crawl_fn or not url:
            return failed_result(self.source_id, "Crawl URL required")
        excerpt, meta = await crawl_fn(url)
        if not excerpt:
            return failed_result(self.source_id, meta or "Crawl failed")
        fields = extract_fn(excerpt) if extract_fn else []
        fields = [
            {"key": f["key"], "value": f["value"], "source": f.get("source", "permit_crawl"), "confidence": f.get("confidence", "low")}
            for f in fields
        ]
        return success_result(self.source_id, fields=fields, message=f"Crawled {url}")
