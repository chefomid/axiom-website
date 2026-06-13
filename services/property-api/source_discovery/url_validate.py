"""Validate public crawl URLs (HTTPS, no private hosts)."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import httpx


def validate_public_https_url(url: str) -> str | None:
    """Return error message if invalid, else None."""
    raw = (url or "").strip()
    if not raw:
        return "URL is empty"
    try:
        parsed = urlparse(raw)
    except Exception:
        return "Invalid URL"
    if parsed.scheme != "https":
        return "URL must use HTTPS"
    host = (parsed.hostname or "").lower()
    if not host:
        return "URL missing host"
    if host in ("localhost", "127.0.0.1", "::1"):
        return "Local URLs are not allowed"
    if host.endswith(".local"):
        return "Local network URLs are not allowed"
    try:
        infos = socket.getaddrinfo(host, None)
        for info in infos:
            addr = info[4][0]
            ip = ipaddress.ip_address(addr)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return "Private network URLs are not allowed"
    except socket.gaierror:
        pass
    except ValueError:
        pass
    return None


def humanize_http_status(status_code: int) -> str:
    if status_code == 503:
        return "Site is temporarily unavailable — paste the URL manually or try again later."
    if status_code in (502, 504):
        return "Site is not responding right now — paste the URL manually or try again later."
    if status_code == 403:
        return "Site blocked automated access — open it in your browser and paste the URL below."
    if status_code == 404:
        return "Page not found — the suggested link may be outdated."
    if status_code >= 500:
        return "Site returned a server error — paste the URL manually or try again later."
    if status_code >= 400:
        return "Could not open this page automatically — verify the link and paste it below."
    return "Could not verify this page."


async def verify_url_reachable(client: httpx.AsyncClient, url: str, *, timeout: float = 8.0) -> str | None:
    """HEAD/GET check; return user-facing error message if unreachable."""
    try:
        r = await client.head(url, timeout=timeout, follow_redirects=True)
        if r.status_code >= 400:
            r = await client.get(url, timeout=timeout, follow_redirects=True)
        if r.status_code >= 400:
            return humanize_http_status(r.status_code)
    except httpx.TimeoutException:
        return "Site took too long to respond — paste the URL manually or try again later."
    except Exception:
        return "Could not reach this site — paste the URL manually if you have it."
    return None
