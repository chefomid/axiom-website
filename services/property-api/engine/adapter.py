"""Source adapter protocol."""

from __future__ import annotations

from typing import Protocol

import httpx

from engine.models import SourceContext, SourceRunResult


class SourceAdapter(Protocol):
    source_id: str

    async def validate(self, ctx: SourceContext) -> str | None:
        """Return skip reason, or None if runnable."""
        ...

    async def fetch(
        self,
        ctx: SourceContext,
        client: httpx.AsyncClient,
        *,
        crawl_fn=None,
        extract_fn=None,
    ) -> SourceRunResult:
        ...


class BaseAdapter:
    source_id: str = ""

    async def validate(self, ctx: SourceContext) -> str | None:
        return None

    async def fetch(
        self,
        ctx: SourceContext,
        client: httpx.AsyncClient,
        *,
        crawl_fn=None,
        extract_fn=None,
    ) -> SourceRunResult:
        raise NotImplementedError
