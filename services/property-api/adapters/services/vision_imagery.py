"""Fetch satellite and Street View imagery for vision construction analysis.

Legacy compatibility layer — Property Inspector uses agents/property_inspector/tools/.
"""

from __future__ import annotations

import httpx

from agents.property_inspector.tools.satellite import fetch_satellite_image
from agents.property_inspector.tools.streetview import (
    InspectorImage,
    fetch_street_view_image,
    fetch_streetview_metadata,
    google_maps_api_key,
    image_to_data_url,
    street_view_available,
)

# Backward-compatible alias
VisionImage = InspectorImage


async def fetch_vision_images(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
) -> tuple[list[VisionImage], list[str]]:
    """Legacy single-heading fetch for callers outside Property Inspector."""
    images: list[VisionImage] = []
    used: list[str] = []

    satellite = await fetch_satellite_image(client, lat, lng)
    if satellite:
        images.append(satellite)
        used.append("satellite")

    gkey = google_maps_api_key()
    if gkey and await street_view_available(client, lat, lng, gkey):
        sv = await fetch_street_view_image(
            client,
            lat=lat,
            lng=lng,
            api_key=gkey,
            image_id="street_0",
            label="Street View (heading 0°)",
            heading=0,
        )
        if sv:
            images.append(sv)
            used.append("street")

    return images, used


__all__ = [
    "VisionImage",
    "fetch_vision_images",
    "fetch_streetview_metadata",
    "google_maps_api_key",
    "image_to_data_url",
    "street_view_available",
]
