"""Send report confirmation numbers via Gmail / Google Workspace SMTP."""

from __future__ import annotations

import asyncio
import os
import re
import smtplib
from email.message import EmailMessage
from typing import Any

from billing.config import frontend_url

DEFAULT_FROM = "contact@axiompropertycasualty.com"
DEFAULT_FROM_NAME = "AXIOM Property & Casualty"
SUBJECT = "Your AXIOM report confirmation number"
_ZIP_SUFFIX_RE = re.compile(r",?\s*\d{5}(?:-\d{4})?\s*$", re.IGNORECASE)


def smtp_host() -> str:
    return (os.environ.get("SMTP_HOST") or "smtp.gmail.com").strip()


def smtp_port() -> int:
    raw = (os.environ.get("SMTP_PORT") or "587").strip()
    try:
        return int(raw)
    except ValueError:
        return 587


def smtp_user() -> str:
    return (os.environ.get("SMTP_USER") or "").strip()


def smtp_app_password() -> str:
    return (os.environ.get("SMTP_APP_PASSWORD") or "").strip()


def email_from() -> str:
    return (os.environ.get("EMAIL_FROM") or smtp_user() or DEFAULT_FROM).strip()


def email_from_name() -> str:
    return (os.environ.get("EMAIL_FROM_NAME") or DEFAULT_FROM_NAME).strip()


def is_email_configured() -> bool:
    return bool(smtp_user() and smtp_app_password())


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


def _send_smtp_sync(to_email: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{email_from_name()} <{email_from()}>"
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(smtp_host(), smtp_port(), timeout=15) as server:
        server.starttls()
        server.login(smtp_user(), smtp_app_password())
        server.send_message(msg)


def send_confirmation_email(
    to_email: str,
    confirmation_id: str,
    *,
    property_label: str | None = None,
) -> None:
    subject, body = build_confirmation_email(
        confirmation_id,
        property_label=property_label,
    )
    _send_smtp_sync(to_email.strip(), subject, body)


async def send_confirmation_email_async(
    to_email: str,
    confirmation_id: str,
    *,
    property_label: str | None = None,
) -> None:
    await asyncio.to_thread(
        send_confirmation_email,
        to_email,
        confirmation_id,
        property_label=property_label,
    )
