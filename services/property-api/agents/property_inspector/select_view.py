"""Phase 2 — select best Street View facade (gpt-4o-mini, low detail)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import httpx

from agents.property_inspector.tools.streetview import InspectorImage, image_to_data_url
from llm.openai_client import DEFAULT_CHAT_MODEL, chat_completion_with_images

_PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "select_view.md"


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8").strip()


def parse_select_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def normalize_select_response(raw: dict[str, Any], valid_ids: set[str]) -> dict[str, Any]:
    selected = str(raw.get("selected_image_id") or "").strip()
    if selected not in valid_ids:
        selected = next(iter(valid_ids), "")

    confidence = str(raw.get("confidence") or "medium").strip().lower()
    if confidence not in {"high", "medium", "low"}:
        confidence = "medium"

    rejected: list[dict[str, str]] = []
    for item in raw.get("rejected_views") or []:
        if not isinstance(item, dict):
            continue
        image_id = str(item.get("image_id") or "").strip()
        reason = str(item.get("reason") or "").strip()
        if image_id and reason:
            rejected.append({"image_id": image_id, "reason": reason})

    return {
        "selected_image_id": selected,
        "subject_identified": bool(raw.get("subject_identified")),
        "subject_description": str(raw.get("subject_description") or "").strip() or None,
        "confidence": confidence,
        "rejected_views": rejected,
    }


async def select_best_view(
    *,
    client: httpx.AsyncClient,
    api_key: str,
    address: str,
    lat: float,
    lng: float,
    street_images: list[InspectorImage],
    satellite: InspectorImage | None,
) -> dict[str, Any]:
    if not street_images:
        return {
            "selected_image_id": "",
            "subject_identified": False,
            "subject_description": None,
            "confidence": "low",
            "rejected_views": [],
            "model": DEFAULT_CHAT_MODEL,
        }

    valid_ids = {img.image_id for img in street_images}
    user_parts: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"Property: {address}\n"
                f"Coordinates: {lat}, {lng}\n"
                f"Street View images: {', '.join(img.image_id for img in street_images)}\n"
                "Select the view that best shows the subject building at this location."
            ),
        }
    ]
    for img in street_images:
        user_parts.append(
            {
                "type": "image_url",
                "image_url": {"url": image_to_data_url(img), "detail": "low"},
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
        model=DEFAULT_CHAT_MODEL,
        timeout=60.0,
    )
    parsed = normalize_select_response(parse_select_json(raw_text), valid_ids)
    parsed["model"] = DEFAULT_CHAT_MODEL
    return parsed
