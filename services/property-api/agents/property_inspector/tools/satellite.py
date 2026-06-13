"""Esri satellite imagery for Property Inspector."""

from __future__ import annotations

import httpx

from agents.property_inspector.tools.streetview import InspectorImage, fetch_bytes

ESRI_EXPORT = (
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
)


def esri_satellite_url(lat: float, lng: float, *, width: int = 640, height: int = 480) -> str:
    pad = 0.00028
    bbox = f"{lng - pad},{lat - pad},{lng + pad},{lat + pad}"
    params = {
        "bbox": bbox,
        "bboxSR": "4326",
        "imageSR": "4326",
        "size": f"{width},{height}",
        "format": "jpg",
        "f": "image",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{ESRI_EXPORT}?{query}"


async def fetch_satellite_image(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
) -> InspectorImage | None:
    url = esri_satellite_url(lat, lng)
    data = await fetch_bytes(client, url)
    if not data:
        return None
    return InspectorImage(
        image_id="satellite",
        label="Satellite (Esri World Imagery)",
        content_type="image/jpeg",
        data=data,
    )
