"""TTL cache for source URL discovery results."""

from __future__ import annotations

import hashlib
import time
from typing import Any

DISCOVERY_TTL_SECONDS = 86400  # 24h

_store: dict[str, tuple[float, dict[str, Any]]] = {}


def _cache_key(address: str, source_ids: list[str]) -> str:
    norm_addr = address.strip().lower()
    ids = ",".join(sorted(source_ids))
    digest = hashlib.sha256(f"{norm_addr}|{ids}".encode()).hexdigest()[:16]
    return f"discover:{digest}"


def get_discovery(address: str, source_ids: list[str]) -> dict[str, Any] | None:
    key = _cache_key(address, source_ids)
    entry = _store.get(key)
    if not entry:
        return None
    expires_at, payload = entry
    if time.monotonic() > expires_at:
        del _store[key]
        return None
    return payload


def set_discovery(address: str, source_ids: list[str], payload: dict[str, Any]) -> None:
    key = _cache_key(address, source_ids)
    _store[key] = (time.monotonic() + DISCOVERY_TTL_SECONDS, payload)
