"""Server-side hazard fetch helpers for property enrichment."""

from __future__ import annotations

import math
from typing import Any

import httpx

USER_AGENT = "AXIOM-PropertyIntelligence/0.1 (property-intelligence)"


def _headers() -> dict[str, str]:
    return {"User-Agent": USER_AGENT, "Accept": "application/json"}


def _small_bbox(lat: float, lng: float, delta: float = 0.002) -> str:
    west = lng - delta
    east = lng + delta
    south = lat - delta
    north = lat + delta
    return f"{west},{south},{east},{north}"


async def fetch_fema_flood(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    params = {
        "geometry": _small_bbox(lat, lng),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
        "returnGeometry": "false",
        "f": "json",
        "resultRecordCount": "5",
        "where": "1=1",
    }
    url = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"
    try:
        r = await client.get(url, params=params, timeout=20.0)
        r.raise_for_status()
        features = r.json().get("features") or []
        if not features:
            return {"summary": "No NFHL flood zone data at pin", "zone": None, "sfha": False}
        attrs = features[0].get("attributes") or {}
        zone = attrs.get("FLD_ZONE") or attrs.get("fld_zone")
        sfha = (attrs.get("SFHA_TF") or "").upper() == "T"
        subty = attrs.get("ZONE_SUBTY") or attrs.get("zone_subty")
        parts = [f"Zone {zone}" if zone else None, subty, "Special Flood Hazard Area" if sfha else None]
        return {
            "summary": " · ".join(p for p in parts if p),
            "zone": zone,
            "sfha": sfha,
            "subtype": subty,
        }
    except Exception as e:
        return {"summary": None, "error": str(e)}


async def fetch_nws_alerts(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    url = "https://api.weather.gov/alerts/active"
    params = {"point": f"{lat:.4f},{lng:.4f}"}
    headers = {**_headers(), "User-Agent": "AXIOM-PropertyIntelligence/0.1 (contact: dev@axiom.local)"}
    try:
        r = await client.get(url, params=params, headers=headers, timeout=20.0)
        r.raise_for_status()
        features = r.json().get("features") or []
        alerts = []
        for feat in features[:10]:
            props = feat.get("properties") or {}
            alerts.append(
                {
                    "event": props.get("event"),
                    "severity": props.get("severity"),
                    "headline": props.get("headline"),
                }
            )
        return {
            "count": len(features),
            "summary": f"{len(features)} active alert(s)" if features else "No active alerts",
            "alerts": alerts,
        }
    except Exception as e:
        return {"count": 0, "summary": None, "error": str(e)}


async def fetch_usgs_seismic(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    params = {
        "format": "geojson",
        "latitude": str(lat),
        "longitude": str(lng),
        "maxradiuskm": "100",
        "minmagnitude": "2.5",
        "limit": "5",
        "orderby": "time",
    }
    url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
    try:
        r = await client.get(url, params=params, timeout=20.0)
        r.raise_for_status()
        features = r.json().get("features") or []
        events = []
        for feat in features:
            props = feat.get("properties") or {}
            events.append(
                {
                    "magnitude": props.get("mag"),
                    "place": props.get("place"),
                    "time": props.get("time"),
                }
            )
        return {
            "count": len(features),
            "summary": f"{len(features)} M2.5+ event(s) within 100 km (last 30 days)"
            if features
            else "No M2.5+ events within 100 km in the last 30 days",
            "events": events,
        }
    except Exception as e:
        return {"count": 0, "summary": None, "error": str(e)}


async def fetch_wildfire_eonet(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    url = "https://eonet.gsfc.nasa.gov/api/v3/events"
    params = {"status": "open", "category": "wildfires", "limit": 50}
    try:
        r = await client.get(url, params=params, timeout=20.0)
        r.raise_for_status()
        events = r.json().get("events") or []
        nearby = []
        for ev in events:
            for geom in ev.get("geometry") or []:
                coords = geom.get("coordinates") or []
                if len(coords) < 2:
                    continue
                elng, elat = float(coords[0]), float(coords[1])
                dist_km = _haversine_km(lat, lng, elat, elng)
                if dist_km <= 150:
                    nearby.append({"title": ev.get("title"), "distance_km": round(dist_km, 1)})
                    break
        nearby.sort(key=lambda x: x["distance_km"])
        return {
            "count": len(nearby),
            "summary": f"{len(nearby)} open wildfire event(s) within 150 km"
            if nearby
            else "No open wildfire events within 150 km",
            "events": nearby[:5],
        }
    except Exception as e:
        return {"count": 0, "summary": None, "error": str(e)}


async def fetch_aqi_openmeteo(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {"latitude": lat, "longitude": lng, "current": "us_aqi,pm2_5"}
    try:
        r = await client.get(url, params=params, timeout=15.0)
        r.raise_for_status()
        current = r.json().get("current") or {}
        aqi = current.get("us_aqi")
        pm25 = current.get("pm2_5")
        if aqi is None:
            return {"summary": "AQI unavailable", "us_aqi": None}
        return {"summary": f"US AQI {aqi} (PM2.5 {pm25})", "us_aqi": aqi, "pm2_5": pm25}
    except Exception as e:
        return {"summary": None, "error": str(e)}


async def fetch_osm_building(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    query = f"""
    [out:json][timeout:15];
    (
      way["building"](around:80,{lat},{lng});
    );
    out tags 5;
    """
    url = "https://overpass-api.de/api/interpreter"
    try:
        r = await client.post(url, content=f"data={query}", timeout=20.0)
        r.raise_for_status()
        elements = r.json().get("elements") or []
        tags_list = [el.get("tags") or {} for el in elements]
        building_types = [t.get("building") for t in tags_list if t.get("building")]
        levels = [t.get("building:levels") for t in tags_list if t.get("building:levels")]
        return {
            "count": len(elements),
            "summary": f"{len(elements)} OSM building(s) within ~80 m"
            if elements
            else "No OSM building footprint within ~80 m",
            "building_types": building_types[:3],
            "levels": levels[:3],
        }
    except Exception as e:
        return {"count": 0, "summary": None, "error": str(e)}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


async def fetch_epa_echo(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    """Nearby EPA-regulated facilities via ECHO REST (aggregate counts within ~1.25 mi)."""
    url = "https://echodata.epa.gov/echo/echo_rest_services.get_facilities"
    params = {
        "p_lat": lat,
        "p_long": lng,
        "p_radius": 1.25,
        "output": "JSON",
    }
    try:
        r = await client.get(url, params=params, timeout=20.0)
        r.raise_for_status()
        payload = r.json()
        results = payload.get("Results") or {}
        if results.get("Error"):
            err = results["Error"]
            message = err.get("ErrorMessage") if isinstance(err, dict) else str(err)
            return {"summary": None, "error": message or "EPA ECHO query failed"}

        total = int(results.get("QueryRows") or 0)
        if total <= 0:
            return {
                "count": 0,
                "summary": "No EPA-regulated facilities within ~1.25 mi",
                "programs": {},
            }

        programs = {
            "air": int(results.get("CAARows") or 0),
            "water": int(results.get("CWARows") or 0),
            "waste": int(results.get("RCRRows") or 0),
            "toxic_release": int(results.get("TRIRows") or 0),
        }
        active = [f"{count} {label}" for label, count in [
            ("CAA", programs["air"]),
            ("CWA", programs["water"]),
            ("RCRA", programs["waste"]),
            ("TRI", programs["toxic_release"]),
        ] if count > 0]
        program_text = ", ".join(active) if active else "mixed programs"
        summary = f"{total} EPA-regulated facilit{'y' if total == 1 else 'ies'} within ~1.25 mi ({program_text})"
        return {
            "count": total,
            "summary": summary,
            "programs": programs,
            "radius_miles": 1.25,
        }
    except Exception as e:
        return {"count": 0, "summary": None, "error": str(e)}
