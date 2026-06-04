"""In-memory TTL cache for source responses."""

from __future__ import annotations

import hashlib
import time
from typing import Any

from engine.models import SourceRunResult


class SourceCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[float, SourceRunResult]] = {}

    @staticmethod
    def _key(source_id: str, lat: float, lng: float, address: str) -> str:
        addr_hash = hashlib.sha256(address.strip().lower().encode()).hexdigest()[:12]
        return f"{source_id}:{lat:.4f}:{lng:.4f}:{addr_hash}"

    def get(
        self,
        source_id: str,
        lat: float,
        lng: float,
        address: str,
        ttl_seconds: int,
    ) -> SourceRunResult | None:
        if ttl_seconds <= 0:
            return None
        key = self._key(source_id, lat, lng, address)
        entry = self._store.get(key)
        if not entry:
            return None
        expires_at, result = entry
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        cached = SourceRunResult(
            source_id=result.source_id,
            status=result.status,
            fields=list(result.fields),
            hazards=dict(result.hazards),
            observations=list(result.observations),
            message=result.message,
            charged=False,
            latency_ms=0,
            cache_hit=True,
        )
        return cached

    def set(
        self,
        source_id: str,
        lat: float,
        lng: float,
        address: str,
        ttl_seconds: int,
        result: SourceRunResult,
    ) -> None:
        if ttl_seconds <= 0 or result.status != "success":
            return
        key = self._key(source_id, lat, lng, address)
        self._store[key] = (time.monotonic() + ttl_seconds, result)


# Module-level singleton for dev; swap for Redis in production.
_cache = SourceCache()


def get_cache() -> SourceCache:
    return _cache
