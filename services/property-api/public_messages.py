"""User-safe API copy — never expose env var names or server setup hints in production."""

from __future__ import annotations

import os
import re

_INTERNAL_MESSAGE = re.compile(
    r"api[_\s-]?key|not configured|\.env|add [A-Z0-9_]+|server \.env|on this server|on the server",
    re.IGNORECASE,
)


def is_production_deploy() -> bool:
    frontend = os.environ.get("FRONTEND_URL", "").strip().lower()
    if "axiompropertycasualty.com" in frontend:
        return True
    return os.environ.get("RENDER", "").strip().lower() == "true"


def public_run_message(message: str | None) -> str | None:
    if not message:
        return None
    if is_production_deploy() and _INTERNAL_MESSAGE.search(message):
        return None
    return message


def public_warning_message(message: str) -> str | None:
    if is_production_deploy() and _INTERNAL_MESSAGE.search(message):
        return None
    return message
