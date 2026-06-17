"""Load source registry and presets from JSON."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

REGISTRY_DIR = Path(__file__).resolve().parent / "registry"


@lru_cache(maxsize=1)
def load_sources_config() -> dict[str, Any]:
    with (REGISTRY_DIR / "sources.json").open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_presets_config() -> dict[str, Any]:
    with (REGISTRY_DIR / "presets.json").open(encoding="utf-8") as f:
        return json.load(f)


def get_margin_multiplier() -> float:
    return float(load_sources_config().get("margin_multiplier", 2.5))


def get_infra_breakeven_usd() -> float:
    return float(load_sources_config().get("infra_breakeven_usd", 0.45))


def get_platform_margin_usd() -> float:
    return float(load_sources_config().get("platform_margin_usd", 1.0))


def get_categories() -> list[dict[str, Any]]:
    return load_sources_config().get("categories", [])


def get_sources() -> list[dict[str, Any]]:
    return load_sources_config().get("sources", [])


def get_source_by_id(source_id: str) -> dict[str, Any] | None:
    for src in get_sources():
        if src["id"] == source_id:
            return src
    return None


def resolve_preset_source_ids(preset: dict[str, Any]) -> list[str]:
    """Expand preset source_ids with any category-based selectable sources."""
    ids: list[str] = list(preset.get("source_ids") or [])
    seen = set(ids)
    for cat_id in preset.get("categories") or []:
        for src in get_sources():
            if src.get("category") != cat_id:
                continue
            if not src.get("selectable"):
                continue
            sid = src["id"]
            if sid not in seen:
                ids.append(sid)
                seen.add(sid)
    return ids


def get_presets() -> list[dict[str, Any]]:
    raw = load_presets_config().get("presets", [])
    materialized: list[dict[str, Any]] = []
    for preset in raw:
        expanded = dict(preset)
        expanded["source_ids"] = resolve_preset_source_ids(preset)
        materialized.append(expanded)
    return materialized


def get_vendors() -> dict[str, Any]:
    return load_sources_config().get("vendors", {})


def default_selected_ids() -> list[str]:
    ids = ["geocode_census"]
    for src in get_sources():
        if src.get("default_selected"):
            ids.append(src["id"])
    return ids


def resolve_selected_sources(selected: list[str] | None) -> list[str]:
    """Always include required sources; expand dependencies."""
    if not selected:
        selected = [s for s in default_selected_ids() if s != "geocode_census"]

    by_id = {s["id"]: s for s in get_sources()}
    resolved: list[str] = []
    seen: set[str] = set()

    def add(source_id: str) -> None:
        if source_id in seen:
            return
        src = by_id.get(source_id)
        if not src:
            return
        for dep in src.get("depends_on") or []:
            add(dep)
        seen.add(source_id)
        resolved.append(source_id)

    add("geocode_census")
    for sid in selected:
        if sid != "geocode_census":
            add(sid)

    return resolved


def filter_configured_source_ids(source_ids: list[str]) -> list[str]:
    """Drop licensed sources that are not wired on this deployment."""
    from adapters.base import api_key_configured

    filtered: list[str] = []
    for sid in source_ids:
        src = get_source_by_id(sid)
        if not src:
            continue
        if src.get("requires_api_key") and not api_key_configured(sid):
            continue
        filtered.append(sid)
    return filtered


def resolve_selected_sources_for_request(selected: list[str] | None) -> list[str]:
    from public_messages import is_production_deploy

    resolved = resolve_selected_sources(selected)
    if is_production_deploy():
        return filter_configured_source_ids(resolved)
    return resolved


def source_available_for_location(src: dict[str, Any], country_hint: str | None) -> bool:
    coverage = src.get("coverage", "global")
    if coverage == "global":
        return True
    if coverage == "US":
        if not country_hint:
            return True
        return country_hint.upper() in ("US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA")
    return True
