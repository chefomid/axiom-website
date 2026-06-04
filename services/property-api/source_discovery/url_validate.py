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


async def verify_url_reachable(client: httpx.AsyncClient, url: str, *, timeout: float = 8.0) -> str | None:
    """HEAD/GET check; return error message if unreachable."""
    try:
        r = await client.head(url, timeout=timeout, follow_redirects=True)
        if r.status_code >= 400:
            r = await client.get(url, timeout=timeout, follow_redirects=True)
        if r.status_code >= 400:
            return f"URL returned HTTP {r.status_code}"
    except httpx.TimeoutException:
        return "URL timed out"
    except Exception as e:
        return f"URL not reachable: {e}"
    return None
