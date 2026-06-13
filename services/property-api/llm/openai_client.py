"""Thin OpenAI HTTP helpers (Chat Completions + Responses API)."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

DEFAULT_CHAT_MODEL = "gpt-4o-mini"
DEFAULT_RESPONSES_MODEL = "gpt-4o-mini"
DEFAULT_VISION_MODEL = "gpt-4o"


def openai_api_key() -> str:
    return os.environ.get("OPENAI_API_KEY", "").strip()


def _openai_error_message(response: httpx.Response | None) -> str:
    if response is None:
        return ""
    try:
        payload = response.json()
    except Exception:
        return (response.text or "").strip()
    if not isinstance(payload, dict):
        return str(payload)
    err = payload.get("error")
    if isinstance(err, dict):
        return str(err.get("message") or err.get("type") or "").strip()
    return str(payload.get("message") or payload).strip()


def format_openai_http_error(exc: httpx.HTTPStatusError, *, context: str = "OpenAI request") -> str:
    """Turn OpenAI HTTP failures into short, actionable messages for the UI."""
    detail = _openai_error_message(exc.response)
    lowered = detail.lower()
    status = exc.response.status_code if exc.response is not None else None

    if "quota" in lowered or "insufficient_quota" in lowered:
        return (
            "OpenAI quota exceeded — add billing at platform.openai.com "
            "or switch to Enter manually for public record URLs."
        )
    if status == 401 or "invalid api key" in lowered or "incorrect api key" in lowered:
        return "Invalid OPENAI_API_KEY on server — check services/property-api/.env"
    if status == 429 or "rate limit" in lowered:
        return "OpenAI rate limit reached — wait a moment and try again."
    if detail:
        return f"{context} failed: {detail[:240]}"
    return f"{context} failed (HTTP {status or 'error'})"


async def chat_completion_with_images(
    *,
    client: httpx.AsyncClient,
    api_key: str,
    messages: list[dict[str, Any]],
    model: str = DEFAULT_VISION_MODEL,
    temperature: float = 0,
    timeout: float = 90.0,
) -> str:
    """Chat Completions with image_url content blocks in message parts."""
    r = await client.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
        },
        timeout=timeout,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


async def chat_completion(
    *,
    client: httpx.AsyncClient,
    api_key: str,
    messages: list[dict[str, str]],
    model: str = DEFAULT_CHAT_MODEL,
    temperature: float = 0,
    timeout: float = 30.0,
) -> str:
    r = await client.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
        },
        timeout=timeout,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


async def responses_with_web_search(
    *,
    client: httpx.AsyncClient,
    api_key: str,
    instructions: str,
    user_input: str,
    model: str = DEFAULT_RESPONSES_MODEL,
    timeout: float = 90.0,
) -> str:
    """Call OpenAI Responses API with web_search_preview tool; return final text."""
    r = await client.post(
        "https://api.openai.com/v1/responses",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "tools": [{"type": "web_search_preview"}],
            "instructions": instructions,
            "input": user_input,
        },
        timeout=timeout,
    )
    r.raise_for_status()
    data = r.json()
    return _extract_response_text(data)


def _extract_response_text(data: dict[str, Any]) -> str:
    """Collect text from Responses API output items."""
    parts: list[str] = []
    for item in data.get("output") or []:
        if item.get("type") == "message":
            for block in item.get("content") or []:
                if block.get("type") in ("output_text", "text"):
                    text = block.get("text")
                    if text:
                        parts.append(text)
    if parts:
        return "\n".join(parts)
    # Fallback for alternate response shapes
    if data.get("output_text"):
        return str(data["output_text"])
    return ""
