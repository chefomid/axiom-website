"""Billing configuration from environment."""

from __future__ import annotations

import os


def stripe_secret_key() -> str:
    return os.environ.get("STRIPE_SECRET_KEY", "").strip()


def stripe_publishable_key() -> str:
    return os.environ.get("STRIPE_PUBLISHABLE_KEY", "").strip()


def stripe_webhook_secret() -> str:
    return os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()


def frontend_url() -> str:
    return (os.environ.get("FRONTEND_URL") or "http://127.0.0.1:5173").rstrip("/")


def database_url() -> str | None:
    url = os.environ.get("DATABASE_URL", "").strip()
    return url or None


def billing_enabled() -> bool:
    return bool(stripe_secret_key())


def billing_status() -> dict:
    from billing import db as billing_db

    return {
        "enabled": billing_enabled(),
        "stripe_configured": bool(stripe_secret_key()),
        "stripe_publishable_configured": bool(stripe_publishable_key()),
        "webhook_configured": bool(stripe_webhook_secret()),
        "database_url_set": bool(database_url()),
        "database_ready": billing_db.is_ready(),
    }
