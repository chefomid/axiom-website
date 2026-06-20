"""Send report confirmation numbers via Resend HTTP API."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import httpx

from billing.config import frontend_url

logger = logging.getLogger(__name__)

DEFAULT_FROM = "contact@axiompropertycasualty.com"
DEFAULT_FROM_NAME = "AXIOM Property & Casualty"
SUBJECT = "Your AXIOM report confirmation number"
RESEND_API_URL = "https://api.resend.com/emails"
HTTP_TIMEOUT = 8
_ZIP_SUFFIX_RE = re.compile(r",?\s*\d{5}(?:-\d{4})?\s*$", re.IGNORECASE)


def resend_api_key() -> str:
    return (os.environ.get("RESEND_API_KEY") or "").strip()


def email_from() -> str:
    return (os.environ.get("EMAIL_FROM") or DEFAULT_FROM).strip()


def email_from_name() -> str:
    return (os.environ.get("EMAIL_FROM_NAME") or DEFAULT_FROM_NAME).strip()


def is_email_configured() -> bool:
    return bool(resend_api_key())


def format_address_without_zip(raw: str) -> str:
    text = raw.strip()
    if not text:
        return ""
    text = _ZIP_SUFFIX_RE.sub("", text).strip().rstrip(",")
    return text


def property_label_from_payload(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("address_input", "display_name"):
        value = payload.get(key)
        if value and str(value).strip():
            formatted = format_address_without_zip(str(value))
            if formatted:
                return formatted
    if payload.get("batch_id"):
        locations = payload.get("locations") or []
        for loc in locations:
            if not isinstance(loc, dict):
                continue
            record = loc.get("record")
            if isinstance(record, dict):
                for key in ("address_input", "display_name"):
                    value = record.get(key)
                    if value and str(value).strip():
                        formatted = format_address_without_zip(str(value))
                        if formatted:
                            return formatted
            address_input = loc.get("address_input")
            if address_input and str(address_input).strip():
                formatted = format_address_without_zip(str(address_input))
                if formatted:
                    return formatted
        enriched = sum(
            1 for loc in locations if isinstance(loc, dict) and loc.get("record") is not None
        )
        if enriched:
            return f"{enriched} location(s)"
        message = payload.get("message")
        if message and str(message).strip():
            return str(message).strip()
    return None


def build_confirmation_email(
    confirmation_id: str,
    *,
    property_label: str | None = None,
    site_url: str | None = None,
) -> tuple[str, str]:
    cid = confirmation_id.strip().upper()
    base = (site_url or frontend_url()).rstrip("/")
    retrieve_url = f"{base}/property-intelligence"

    lines = [
        "Hi,",
        "",
        f"Your report confirmation number is {cid}.",
    ]
    if property_label:
        lines.append(f"Report: {property_label}")
    lines.extend(
        [
            "",
            f'Retrieve your report anytime at {retrieve_url} using "Retrieve with confirmation number".',
            "",
            "Thank you,",
            "AXIOM Property & Casualty team",
        ]
    )
    return SUBJECT, "\n".join(lines)


async def _send_resend(to_email: str, subject: str, body: str) -> None:
    payload = {
        "from": f"{email_from_name()} <{email_from()}>",
        "to": [to_email],
        "subject": subject,
        "text": body,
    }
    headers = {
        "Authorization": f"Bearer {resend_api_key()}",
        "Content-Type": "application/json",
    }
    logger.info("Sending confirmation email via Resend to %s", to_email)
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        response = await client.post(RESEND_API_URL, json=payload, headers=headers)
        response.raise_for_status()


async def send_confirmation_email_async(
    to_email: str,
    confirmation_id: str,
    *,
    property_label: str | None = None,
) -> None:
    subject, body = build_confirmation_email(
        confirmation_id,
        property_label=property_label,
    )
    await _send_resend(to_email.strip(), subject, body)
