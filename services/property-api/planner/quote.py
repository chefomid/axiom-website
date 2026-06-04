"""Build live and final receipts from selected sources."""

from __future__ import annotations

import os
from typing import Any

from registry_loader import (
    get_margin_multiplier,
    get_minimum_charge,
    get_source_by_id,
    resolve_selected_sources,
    source_available_for_location,
)


def _round_usd(value: float) -> float:
    return round(value, 2)


def _api_key_configured(src: dict[str, Any]) -> bool:
    env_key = src.get("env_key")
    if not env_key:
        return True
    return bool(os.environ.get(env_key, "").strip())


def build_line_items(
    selected_sources: list[str],
    *,
    country_hint: str | None = None,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for source_id in selected_sources:
        src = get_source_by_id(source_id)
        if not src:
            continue
        available = source_available_for_location(src, country_hint)
        key_ok = not src.get("requires_api_key") or _api_key_configured(src)
        items.append(
            {
                "source_id": source_id,
                "label": src["label"],
                "description": src.get("description"),
                "category": src.get("category"),
                "tier": src.get("tier"),
                "vendor": src.get("vendor"),
                "featured": bool(src.get("featured")),
                "badge": src.get("badge"),
                "marketing_note": src.get("marketing_note"),
                "cope_sections": src.get("cope_sections") or [],
                "api_cost_usd": float(src.get("api_cost_usd", 0)),
                "service_cost_usd": float(src.get("service_cost_usd", 0)),
                "enabled": True,
                "selectable": bool(src.get("selectable", True)),
                "required": bool(src.get("required", False)),
                "available": available,
                "configured": key_ok,
                "needs_source_url": bool(src.get("needs_source_url")),
                "requires_api_key": bool(src.get("requires_api_key")),
            }
        )
    return items


def _billable(item: dict[str, Any]) -> bool:
    return (
        item.get("enabled")
        and item.get("available", True)
        and item.get("configured", True)
    )


def compute_totals(line_items: list[dict[str, Any]]) -> dict[str, float]:
    api_cost = sum(i["api_cost_usd"] for i in line_items if _billable(i))
    service_cost = sum(i["service_cost_usd"] for i in line_items if _billable(i))
    loaded = api_cost + service_cost
    multiplier = get_margin_multiplier()
    user_price = _round_usd(loaded * multiplier)
    min_charge = get_minimum_charge()
    if api_cost > 0 and user_price < min_charge:
        user_price = min_charge
    return {
        "api_cost_usd": _round_usd(api_cost),
        "service_cost_usd": _round_usd(service_cost),
        "loaded_cost_usd": _round_usd(loaded),
        "margin_multiplier": multiplier,
        "user_price_usd": user_price,
    }


def build_quote(
    *,
    address_input: str,
    selected_sources: list[str] | None,
    display_name: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    country_hint: str | None = None,
) -> dict[str, Any]:
    resolved = resolve_selected_sources(selected_sources)
    line_items = build_line_items(resolved, country_hint=country_hint)
    totals = compute_totals(line_items)
    return {
        "address_input": address_input,
        "display_name": display_name,
        "lat": lat,
        "lng": lng,
        "selected_sources": resolved,
        "line_items": line_items,
        "totals": totals,
    }


def _configured_property_sources(selected_sources: list[str]) -> list[str]:
    property_ids = {
        "rentcast_property",
        "attom_property",
        "melissa_property",
        "regrid_parcel",
        "corelogic_property",
    }
    configured: list[str] = []
    for sid in selected_sources:
        if sid not in property_ids:
            continue
        src = get_source_by_id(sid)
        if not src:
            continue
        if src.get("requires_api_key") and not _api_key_configured(src):
            continue
        configured.append(sid)
    return configured


def warnings_for_selection(selected_sources: list[str]) -> list[str]:
    warnings: list[str] = []
    property_ids = {
        "rentcast_property",
        "attom_property",
        "melissa_property",
        "regrid_parcel",
        "corelogic_property",
    }
    insurance_ids = {"attom_property", "attom_hazard"}
    selected_property = [s for s in selected_sources if s in property_ids]
    selected_insurance = [s for s in selected_sources if s in insurance_ids]
    configured_property = _configured_property_sources(selected_sources)
    insurance_configured = any(
        get_source_by_id(s) and _api_key_configured(get_source_by_id(s) or {})
        for s in selected_insurance
    )

    if len(selected_property) >= 3:
        warnings.append(
            "Three property databases selected — consider removing one to reduce API cost."
        )
    if "cope_map" in selected_sources and not configured_property:
        warnings.append(
            "COPE snapshot will have gaps — add ATTOM for carrier-grade Construction & Occupancy."
        )
    if "llm_conflict_resolve" in selected_sources and len(configured_property) < 2:
        warnings.append(
            "Conflict resolution requires two or more property record sources."
        )
    if "attom_hazard" in selected_sources and "attom_property" not in selected_sources:
        warnings.append("ATTOM hazard is typically paired with ATTOM property detail.")
    if selected_insurance and not insurance_configured:
        warnings.append(
            "ATTOM is not configured on this server — insurance-grade sources will be skipped. "
            "Add ATTOM_API_KEY to services/property-api/.env or use the free COPE preset."
        )
    else:
        for sid in selected_sources:
            src = get_source_by_id(sid)
            if src and src.get("requires_api_key") and not _api_key_configured(src):
                warnings.append(f"{src['label']} requires an API key (not configured on server).")
    return warnings
