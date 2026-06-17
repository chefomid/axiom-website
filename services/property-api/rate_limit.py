"""Rate limiting with structured 429 responses for transparent UX."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)


def rate_limit_detail(*, retry_after_seconds: int = 60) -> dict[str, Any]:
    return {
        "code": "rate_limit",
        "message": (
            "You've hit a temporary usage limit. "
            "Please wait about a minute and try again."
        ),
        "safety_note": (
            "We apply fair limits to keep the site reliable and safe for everyone."
        ),
        "retry_after_seconds": retry_after_seconds,
    }


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    retry_after = 60
    if exc.detail and isinstance(exc.detail, str):
        # slowapi may embed window info in detail; default to 60s for UX copy
        pass
    payload = {"detail": rate_limit_detail(retry_after_seconds=retry_after)}
    return JSONResponse(
        status_code=429,
        content=payload,
        headers={"Retry-After": str(retry_after)},
    )
