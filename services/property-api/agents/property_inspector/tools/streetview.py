"""Google Street View metadata and static image fetch."""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from typing import Any

import httpx

GOOGLE_STREETVIEW_METADATA = "https://maps.googleapis.com/maps/api/streetview/metadata"
GOOGLE_STREETVIEW_STATIC = "https://maps.googleapis.com/maps/api/streetview"


@dataclass
class InspectorImage:
    image_id: str
    label: str
    content_type: str
    data: bytes
    heading: int | None = None
    pitch: int = 0
    fov: int = 85


@dataclass
class StreetViewMetadata:
    status: str
    pano_id: str | None = None
    lat: float | None = None
    lng: float | None = None
    date: str | None = None
    copyright: str | None = None


def google_maps_api_key() -> str:
    return (
        os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
        or os.environ.get("VITE_GOOGLE_MAPS_API_KEY", "").strip()
    )


def normalize_heading(deg: float) -> int:
    return int(round(deg)) % 360


def clamp_pitch(pitch: int) -> int:
    return max(-30, min(30, pitch))


def clamp_fov(fov: int) -> int:
    return max(55, min(100, fov))


async def fetch_bytes(client: httpx.AsyncClient, url: str, *, timeout: float = 30.0) -> bytes | None:
    try:
        r = await client.get(url, timeout=timeout)
        r.raise_for_status()
        if r.content and len(r.content) > 500:
            return r.content
    except Exception:
        return None
    return None


async def fetch_streetview_metadata(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
    api_key: str,
) -> StreetViewMetadata:
    params = {"location": f"{lat},{lng}", "key": api_key}
    try:
        r = await client.get(GOOGLE_STREETVIEW_METADATA, params=params, timeout=15.0)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return StreetViewMetadata(status="ERROR")

    if data.get("status") != "OK":
        return StreetViewMetadata(status=data.get("status") or "UNKNOWN")

    loc = data.get("location") or {}
    return StreetViewMetadata(
        status="OK",
        pano_id=data.get("pano_id"),
        lat=loc.get("lat"),
        lng=loc.get("lng"),
        date=data.get("date"),
        copyright=data.get("copyright"),
    )


def street_view_static_url(
    lat: float,
    lng: float,
    api_key: str,
    *,
    heading: int = 0,
    pitch: int = 0,
    fov: int = 85,
    width: int = 640,
    height: int = 480,
) -> str:
    params = {
        "size": f"{width}x{height}",
        "location": f"{lat},{lng}",
        "heading": str(normalize_heading(heading)),
        "pitch": str(clamp_pitch(pitch)),
        "fov": str(clamp_fov(fov)),
        "key": api_key,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{GOOGLE_STREETVIEW_STATIC}?{query}"


async def fetch_street_view_image(
    client: httpx.AsyncClient,
    *,
    lat: float,
    lng: float,
    api_key: str,
    image_id: str,
    label: str,
    heading: int,
    pitch: int = 0,
    fov: int = 85,
) -> InspectorImage | None:
    url = street_view_static_url(lat, lng, api_key, heading=heading, pitch=pitch, fov=fov)
    data = await fetch_bytes(client, url)
    if not data:
        return None
    return InspectorImage(
        image_id=image_id,
        label=label,
        content_type="image/jpeg",
        data=data,
        heading=normalize_heading(heading),
        pitch=clamp_pitch(pitch),
        fov=clamp_fov(fov),
    )


def image_to_data_url(image: InspectorImage) -> str:
    b64 = base64.standard_b64encode(image.data).decode("ascii")
    return f"data:{image.content_type};base64,{b64}"


def serialize_imagery_captures(
    images_by_id: dict[str, InspectorImage],
    *,
    street_images: list[InspectorImage] | None = None,
    selected_image_id: str | None = None,
) -> list[dict[str, Any]]:
    """Serialize captured imagery for report UI/PDF (data URLs)."""
    previews: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(img: InspectorImage, *, selected: bool = False) -> None:
        if img.image_id in seen:
            return
        seen.add(img.image_id)
        previews.append(
            {
                "image_id": img.image_id,
                "label": img.label,
                "heading": img.heading,
                "pitch": img.pitch,
                "selected": selected,
                "data_url": image_to_data_url(img),
            }
        )

    selected_id = (selected_image_id or "").strip()
    if selected_id and selected_id in images_by_id:
        add(images_by_id[selected_id], selected=True)

    for img in street_images or []:
        if img.image_id != selected_id:
            add(img)

    satellite = images_by_id.get("satellite")
    if satellite and satellite.image_id != selected_id:
        add(satellite)

    return previews


async def street_view_available(client: httpx.AsyncClient, lat: float, lng: float, api_key: str) -> bool:
    meta = await fetch_streetview_metadata(client, lat, lng, api_key)
    return meta.status == "OK"
