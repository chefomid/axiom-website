"""Report PDF generation via Playwright (sync in thread pool — reliable on Windows)."""

from __future__ import annotations

import asyncio
import os
import re
import time
import uuid
from typing import Any

from fastapi import HTTPException
from fastapi.responses import Response

from report_html import render_report_html

SESSION_TTL_SECONDS = int(os.getenv("REPORT_SESSION_TTL_SECONDS", "900"))

_sessions: dict[str, dict[str, Any]] = {}


def _purge_expired() -> None:
    now = time.time()
    expired = [sid for sid, entry in _sessions.items() if entry["expires_at"] <= now]
    for sid in expired:
        del _sessions[sid]


def create_session(document: dict[str, Any]) -> str:
    _purge_expired()
    session_id = uuid.uuid4().hex
    _sessions[session_id] = {
        "document": document,
        "expires_at": time.time() + SESSION_TTL_SECONDS,
    }
    return session_id


def get_session(session_id: str) -> dict[str, Any]:
    _purge_expired()
    entry = _sessions.get(session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Report session not found or expired.")
    return entry["document"]


def _slugify_location(label: str | None) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(label or "location").lower()).strip("-")
    return (slug or "location")[:60]


def _generate_pdf_sync(document: dict[str, Any]) -> bytes:
    """Blocking Playwright call — run via asyncio.to_thread."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright not installed. Run: cd services/property-api && "
            "python -m pip install -r requirements.txt && python -m playwright install chromium"
        ) from exc

    html = render_report_html(document)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, timeout=30_000)
        try:
            page = browser.new_page(viewport={"width": 816, "height": 1056})
            page.set_content(html, wait_until="load", timeout=30_000)
            page.wait_for_selector("#report-print-ready", timeout=15_000)
            return page.pdf(
                format="Letter",
                margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
                print_background=True,
                prefer_css_page_size=True,
            )
        finally:
            browser.close()


async def generate_pdf_from_document(document: dict[str, Any]) -> bytes:
    try:
        return await asyncio.to_thread(_generate_pdf_sync, document)
    except HTTPException:
        raise
    except Exception as exc:
        detail = str(exc).strip() or repr(exc)
        raise HTTPException(status_code=502, detail=f"PDF generation failed: {detail}") from exc


async def generate_pdf_bytes(session_id: str) -> bytes:
    return await generate_pdf_from_document(get_session(session_id))


async def pdf_response_for_document(document: dict[str, Any]) -> Response:
    pdf_bytes = await generate_pdf_from_document(document)
    slug = _slugify_location((document.get("meta") or {}).get("location"))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="seismic-report-{slug}.pdf"'},
    )


async def pdf_response(session_id: str) -> Response:
    document = get_session(session_id)
    return await pdf_response_for_document(document)


def check_playwright_ready() -> tuple[bool, str | None]:
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        return False, "Playwright not installed. Run: python -m pip install -r requirements.txt"
    return True, None
