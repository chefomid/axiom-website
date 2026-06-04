"""OSINT adapters for free COPE enrichment."""

from __future__ import annotations

import math
from typing import Any

import httpx

from adapters import hazards


async def fetch_poi_exposure(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    """High-risk POI categories within ~500m via Overpass."""
    query = f"""
    [out:json][timeout:20];
    (
      node["amenity"~"fuel|restaurant|fast_food|bar"](around:500,{lat},{lng});
      way["amenity"~"fuel|restaurant|fast_food|bar"](around:500,{lat},{lng});
      node["industrial"](around:500,{lat},{lng});
      way["industrial"](around:500,{lat},{lng});
      node["shop"~"car|car_repair|hardware"](around:500,{lat},{lng});
    );
    out tags 15;
    """
    url = "https://overpass-api.de/api/interpreter"
    try:
        r = await client.post(url, content=f"data={query}", timeout=25.0)
        r.raise_for_status()
        elements = r.json().get("elements") or []
        labels: list[str] = []
        for el in elements[:10]:
            tags = el.get("tags") or {}
            name = tags.get("name") or tags.get("amenity") or tags.get("shop") or tags.get("industrial")
            if name:
                labels.append(str(name))
        summary = ", ".join(labels[:5]) if labels else "No high-risk POI within ~500 m"
        return {"summary": summary, "count": len(elements), "labels": labels[:8]}
    except Exception as e:
        return {"summary": None, "error": str(e)}


async def fetch_fire_station_distance(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    query = f"""
    [out:json][timeout:15];
    node["amenity"="fire_station"](around:25000,{lat},{lng});
    out 1;
    """
    url = "https://overpass-api.de/api/interpreter"
    try:
        r = await client.post(url, content=f"data={query}", timeout=20.0)
        r.raise_for_status()
        elements = r.json().get("elements") or []
        if not elements:
            return {"summary": "No fire station found within 25 km (OSM)", "distance_mi": None}
        el = elements[0]
        slat, slng = el.get("lat"), el.get("lon")
        if slat is None or slng is None:
            return {"summary": "Fire station found (distance unknown)", "distance_mi": None}
        dist_km = _haversine_km(lat, lng, float(slat), float(slng))
        dist_mi = dist_km * 0.621371
        return {"summary": f"Nearest fire station ~{dist_mi:.1f} mi (OSM)", "distance_mi": round(dist_mi, 1)}
    except Exception as e:
        return {"summary": None, "error": str(e)}


async def fetch_hydrant_proximity(client: httpx.AsyncClient, lat: float, lng: float) -> dict[str, Any]:
    query = f"""
    [out:json][timeout:15];
    node["emergency"="fire_hydrant"](around:500,{lat},{lng});
    out 1;
    """
    url = "https://overpass-api.de/api/interpreter"
    try:
        r = await client.post(url, content=f"data={query}", timeout=20.0)
        r.raise_for_status()
        elements = r.json().get("elements") or []
        if elements:
            return {"summary": "Fire hydrant within ~500 m (OSM)", "within_500ft": "likely"}
        return {"summary": "No OSM hydrant within ~500 m — may still exist", "within_500ft": "unknown"}
    except Exception as e:
        return {"summary": None, "error": str(e)}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))
