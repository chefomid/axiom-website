"""Thin OpenAI HTTP helpers (Chat Completions + Responses API)."""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_CHAT_MODEL = "gpt-4o-mini"
DEFAULT_RESPONSES_MODEL = "gpt-4o-mini"


def openai_api_key() -> str:
    return os.environ.get("OPENAI_API_KEY", "").strip()


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
