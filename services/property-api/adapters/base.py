"""Shared adapter helpers."""

from __future__ import annotations

import os
from typing import Any

from engine.models import Observation, SourceRunResult
from engine.normalize import observations_from_fields, observations_from_mapping
from registry_loader import get_source_by_id


def api_key_configured(source_id: str) -> bool:
    src = get_source_by_id(source_id) or {}
    env_key = src.get("env_key")
    if not env_key:
        return True
    return bool(os.environ.get(env_key, "").strip())


def success_result(
    source_id: str,
    *,
    fields: list[dict[str, Any]] | None = None,
    hazards: dict[str, Any] | None = None,
    raw_data: dict[str, Any] | None = None,
    source_bucket: str | None = None,
    message: str | None = None,
) -> SourceRunResult:
    obs: list[Observation] = []
    if raw_data:
        obs = observations_from_mapping(raw_data, source_id, source_bucket=source_bucket)
    elif fields:
        obs = observations_from_fields(fields, source_id)
    return SourceRunResult(
        source_id=source_id,
        status="success",
        fields=fields or [],
        hazards=hazards or {},
        observations=obs,
        message=message,
    )


def failed_result(source_id: str, message: str) -> SourceRunResult:
    return SourceRunResult(source_id, status="failed", message=message, charged=False)


def skipped_result(source_id: str, message: str) -> SourceRunResult:
    return SourceRunResult(source_id, status="skipped", message=message, charged=False)
