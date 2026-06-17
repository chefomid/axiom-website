#!/usr/bin/env python3
"""Smoke-test billing API (no Stripe payment). Run from repo root with API deps installed."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent / "services" / "property-api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


def main() -> int:
    client = TestClient(app)
    errors: list[str] = []

    r = client.get("/health")
    if r.status_code != 200:
        errors.append(f"/health -> {r.status_code}")

    r = client.get("/billing/packs")
    if r.status_code != 200:
        errors.append(f"/billing/packs -> {r.status_code}")
    else:
        data = r.json()
        if "packs" not in data:
            errors.append("/billing/packs missing packs key")

    anon = str(uuid.uuid4())
    r = client.get(f"/billing/balance?anon_id={anon}")
    if r.status_code != 200:
        errors.append(f"/billing/balance -> {r.status_code}")
    else:
        bal = r.json()
        if bal.get("balance_credits", -1) != 0:
            errors.append(f"new wallet expected 0 credits, got {bal}")

    preview_params = {
        "anon_id": anon,
        "purpose": "discover",
        "address": "123 Main St, Austin, TX 78701",
    }
    r = client.get("/billing/checkout-preview", params=preview_params)
    if r.status_code != 200:
        errors.append(f"/billing/checkout-preview -> {r.status_code}")
    else:
        preview = r.json()
        for key in (
            "sufficient",
            "charge_usd",
            "needed_credits",
            "balance_credits",
            "billing_enabled",
        ):
            if key not in preview:
                errors.append(f"/billing/checkout-preview missing {key}")

    if errors:
        for e in errors:
            print(f"FAIL: {e}")
        return 1

    packs = client.get("/billing/packs").json()
    enabled = packs.get("billing_enabled")
    publishable = (packs.get("stripe_publishable_key") or "").strip()
    print(f"OK: health, packs ({len(packs.get('packs', []))} packs), balance for anon_id")
    print(f"    billing_enabled={enabled}")
    print("    checkout-preview OK")
    if not enabled:
        print("    (Stripe not configured — checkout disabled; set STRIPE_SECRET_KEY to test Checkout)")
    elif not publishable:
        print("    WARN: STRIPE_PUBLISHABLE_KEY missing — desktop Apple Pay in-modal needs pk_test_/pk_live_")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
