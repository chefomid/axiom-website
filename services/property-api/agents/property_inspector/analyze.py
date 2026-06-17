"""Phase 3 — deep facade analysis (gpt-4o, high detail)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import httpx

from agents.property_inspector.tools.streetview import InspectorImage, image_to_data_url
from llm.openai_client import DEFAULT_VISION_MODEL, chat_completion_with_images

_PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "analyze_facade.md"


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8").strip()


def parse_analyze_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def analyze_facade(
    *,
    client: httpx.AsyncClient,
    api_key: str,
    address: str,
    lat: float,
    lng: float,
    selected: InspectorImage,
    floor_scan_images: list[InspectorImage] | None = None,
    satellite: InspectorImage | None,
    prior_note: str,
    subject_description: str | None,
) -> tuple[dict[str, Any], str]:
    scan_images = floor_scan_images or []
    scan_note = ""
    if scan_images:
        scan_lines = [
            f"- {img.image_id}: heading {img.heading}°, pitch {img.pitch}° ({img.label})"
            for img in scan_images
        ]
        scan_note = (
            "Vertical pitch scans (same heading, tilted up/down to reveal full building height):\n"
            + "\n".join(scan_lines)
            + "\nUse upward pitch views to count upper floor bands cut off in the level view."
        )

    user_parts: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"Property: {address}\n"
                f"Coordinates: {lat}, {lng}\n"
                f"Primary image: {selected.image_id} (heading {selected.heading}°, pitch {selected.pitch}°)\n"
                f"Subject: {subject_description or 'building at pin'}\n"
                f"{prior_note}\n"
                f"{scan_note}\n"
                "Analyze visible construction, facade materials, roof, and story count."
            ),
        },
        {
            "type": "image_url",
            "image_url": {"url": image_to_data_url(selected), "detail": "high"},
        },
    ]
    for img in scan_images:
        user_parts.append(
            {
                "type": "text",
                "text": f"Pitch scan: {img.image_id} (heading {img.heading}°, pitch {img.pitch}°)",
            }
        )
        user_parts.append(
            {
                "type": "image_url",
                "image_url": {"url": image_to_data_url(img), "detail": "high"},
            }
        )
    if satellite:
        user_parts.append(
            {
                "type": "image_url",
                "image_url": {"url": image_to_data_url(satellite), "detail": "low"},
            }
        )

    raw_text = await chat_completion_with_images(
        client=client,
        api_key=api_key,
        messages=[
            {"role": "system", "content": _load_prompt()},
            {"role": "user", "content": user_parts},
        ],
        model=DEFAULT_VISION_MODEL,
        timeout=90.0,
    )
    return parse_analyze_json(raw_text), raw_text
