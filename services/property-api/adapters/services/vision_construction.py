"""OpenAI vision analysis via Property Inspector agent."""

from __future__ import annotations

import httpx

from adapters.base import api_key_configured, failed_result
from agents.property_inspector.runner import run_property_inspector
from engine.adapter import BaseAdapter
from engine.models import SourceContext, SourceRunResult
from llm.openai_client import format_openai_http_error


class VisionConstructionAdapter(BaseAdapter):
    source_id = "vision_construction"

    async def validate(self, ctx: SourceContext) -> str | None:
        if not api_key_configured(self.source_id):
            return "Configure OPENAI_API_KEY for image construction analysis"
        return None

    async def fetch(self, ctx: SourceContext, client: httpx.AsyncClient, **kwargs) -> SourceRunResult:
        try:
            return await run_property_inspector(ctx, client)
        except httpx.HTTPStatusError as e:
            return failed_result(
                self.source_id,
                format_openai_http_error(e, context="Property Inspector analysis"),
            )
        except Exception as e:
            return failed_result(self.source_id, f"Property Inspector failed: {e}")
