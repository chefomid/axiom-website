#!/usr/bin/env python3
"""Build a .env block for Render axiom-report-api from local dev secrets (never commit output)."""

from __future__ import annotations

import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
API_ENV = REPO / "services" / "property-api" / ".env"
ROOT_ENV_LOCAL = REPO / ".env.local"
STRIPE_TXT = REPO / "stripe.txt"
OUT = REPO / "render.env.upload"

# Keys we use in production (no CoreLogic, Regrid, or First Street).
RENDER_KEYS = (
    "FRONTEND_URL",
    "REPORT_SESSION_TTL_SECONDS",
    "RENTCAST_API_KEY",
    "ATTOM_API_KEY",
    "MELISSA_LICENSE_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_MAPS_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "DATABASE_URL",
)


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def _parse_stripe_txt(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            out[key.strip().upper()] = value.strip().strip('"').strip("'")
            continue
        if line.startswith("sk_"):
            out["STRIPE_SECRET_KEY"] = line
        elif line.startswith("pk_"):
            out["STRIPE_PUBLISHABLE_KEY"] = line
    return out


def main() -> int:
    values: dict[str, str] = {
        "FRONTEND_URL": "https://www.axiompropertycasualty.com",
        "REPORT_SESSION_TTL_SECONDS": "900",
    }
    values.update(_parse_env_file(API_ENV))
    values.update(_parse_env_file(ROOT_ENV_LOCAL))
    values.update(_parse_stripe_txt(STRIPE_TXT))
    if not values.get("GOOGLE_MAPS_API_KEY"):
        vite_maps = values.get("VITE_GOOGLE_MAPS_API_KEY", "").strip()
        if vite_maps:
            values["GOOGLE_MAPS_API_KEY"] = vite_maps

    lines: list[str] = [
        "# Paste into Render → axiom-report-api → Environment → Add from .env",
        "# Then choose Save, rebuild, and deploy",
        "",
    ]
    missing: list[str] = []
    for key in RENDER_KEYS:
        val = values.get(key, "").strip()
        if not val:
            missing.append(key)
            lines.append(f"# {key}=   # MISSING — set manually in Render")
        else:
            lines.append(f"{key}={val}")

    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(REPO)}")
    if missing:
        print("Missing locally (set in Render dashboard):", ", ".join(missing))
    else:
        print("All production keys found locally.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
