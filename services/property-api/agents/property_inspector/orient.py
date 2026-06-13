"""Deterministic Street View orientation and capture planning."""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from agents.property_inspector.tools.streetview import StreetViewMetadata, normalize_heading


@dataclass
class CaptureSpec:
    image_id: str
    label: str
    heading: int
    pitch: int = 0
    fov: int = 85


@dataclass
class OrientPlan:
    property_lat: float
    property_lng: float
    street_metadata: StreetViewMetadata | None
    bearing_deg: int | None
    capture_specs: list[CaptureSpec] = field(default_factory=list)
    osm_levels: list[str] = field(default_factory=list)
    osm_building_count: int = 0


def compute_bearing(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> int:
    """Bearing in degrees from (from_lat, from_lng) to (to_lat, to_lng), 0=N clockwise."""
    lat1 = math.radians(from_lat)
    lat2 = math.radians(to_lat)
    dlon = math.radians(to_lng - from_lng)
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.degrees(math.atan2(x, y))
    return normalize_heading(bearing)


def build_capture_plan(
    *,
    property_lat: float,
    property_lng: float,
    street_metadata: StreetViewMetadata | None,
    osm_levels: list[str] | None = None,
    osm_building_count: int = 0,
    offset_deg: int = 35,
) -> OrientPlan:
    """Build up to 4 Street View capture headings aimed at the subject property."""
    specs: list[CaptureSpec] = []
    bearing: int | None = None

    if street_metadata and street_metadata.status == "OK":
        if street_metadata.lat is not None and street_metadata.lng is not None:
            bearing = compute_bearing(
                street_metadata.lat,
                street_metadata.lng,
                property_lat,
                property_lng,
            )
            headings = [
                (bearing, "street_bearing", f"Street View (bearing {bearing}°)"),
                (
                    normalize_heading(bearing - offset_deg),
                    "street_bearing_minus",
                    f"Street View (bearing {normalize_heading(bearing - offset_deg)}°)",
                ),
                (
                    normalize_heading(bearing + offset_deg),
                    "street_bearing_plus",
                    f"Street View (bearing {normalize_heading(bearing + offset_deg)}°)",
                ),
            ]
            seen: set[int] = set()
            for heading, image_id, label in headings:
                if heading in seen:
                    continue
                seen.add(heading)
                specs.append(CaptureSpec(image_id=image_id, label=label, heading=heading))
                if len(specs) >= 4:
                    break
        else:
            for heading in (0, 90, 180, 270):
                specs.append(
                    CaptureSpec(
                        image_id=f"street_{heading}",
                        label=f"Street View (heading {heading}°)",
                        heading=heading,
                    )
                )

    return OrientPlan(
        property_lat=property_lat,
        property_lng=property_lng,
        street_metadata=street_metadata,
        bearing_deg=bearing,
        capture_specs=specs[:4],
        osm_levels=list(osm_levels or [])[:3],
        osm_building_count=osm_building_count,
    )
