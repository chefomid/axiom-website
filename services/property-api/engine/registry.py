"""Adapter registry — maps source_id to adapter instances."""

from __future__ import annotations

from engine.adapter import SourceAdapter


def _build_registry() -> dict[str, SourceAdapter]:
    from adapters.crawl.assessor import AssessorCrawlAdapter, PermitCrawlAdapter
    from adapters.hazards.aqi import HazardAqiAdapter
    from adapters.hazards.epa import HazardEpaAdapter
    from adapters.hazards.fema import HazardFemaAdapter
    from adapters.hazards.nws import HazardNwsAdapter
    from adapters.hazards.usgs import HazardUsgsAdapter
    from adapters.hazards.wildfire import HazardWildfireAdapter
    from adapters.osint.fire_station import FireStationAdapter
    from adapters.osint.hydrant import HydrantAdapter
    from adapters.osint.osm import OsmFootprintAdapter
    from adapters.osint.poi import PoiExposureAdapter
    from adapters.osint.stubs import CountyParcelStubAdapter, OpenAddressesStubAdapter
    from adapters.services.sov_orchestrator import SovOrchestratorAdapter
    from adapters.services.post_process import PostProcessAdapter
    from adapters.services.vision_construction import VisionConstructionAdapter
    from adapters.services.web_property_research import WebPropertyResearchAdapter
    from adapters.vendors.attom import AttomHazardAdapter, AttomPropertyAdapter
    from adapters.vendors.corelogic import CoreLogicPropertyAdapter, CoreLogicSpatialAdapter
    from adapters.vendors.firststreet import FirstStreetAdapter
    from adapters.vendors.melissa import MelissaPropertyAdapter
    from adapters.vendors.regrid import RegridParcelAdapter
    from adapters.vendors.rentcast import RentCastPropertyAdapter

    adapters: list[SourceAdapter] = [
        HazardFemaAdapter(),
        HazardNwsAdapter(),
        HazardUsgsAdapter(),
        HazardWildfireAdapter(),
        HazardAqiAdapter(),
        HazardEpaAdapter(),
        PoiExposureAdapter(),
        FireStationAdapter(),
        HydrantAdapter(),
        OsmFootprintAdapter(),
        OpenAddressesStubAdapter(),
        CountyParcelStubAdapter(),
        RentCastPropertyAdapter(),
        AssessorCrawlAdapter(),
        PermitCrawlAdapter(),
        AttomPropertyAdapter(),
        AttomHazardAdapter(),
        CoreLogicPropertyAdapter(),
        CoreLogicSpatialAdapter(),
        MelissaPropertyAdapter(),
        RegridParcelAdapter(),
        FirstStreetAdapter(),
        PostProcessAdapter("cope_map"),
        PostProcessAdapter("pdf_dossier"),
        PostProcessAdapter("llm_extract"),
        SovOrchestratorAdapter(),
        WebPropertyResearchAdapter(),
        VisionConstructionAdapter(),
    ]
    return {a.source_id: a for a in adapters}


_REGISTRY: dict[str, SourceAdapter] | None = None


def get_adapter(source_id: str) -> SourceAdapter | None:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = _build_registry()
    return _REGISTRY.get(source_id)
