#!/usr/bin/env python3
"""Print which Property Intelligence vendor API keys are configured."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_DIR = ROOT / "services" / "property-api"
sys.path.insert(0, str(API_DIR))

from env_loader import env_status_payload, load_project_env  # noqa: E402


def main() -> int:
    loaded = load_project_env()
    payload = env_status_payload()
    print("Property Intelligence — API key status\n")
    if loaded:
        print("Loaded env files:")
        for p in loaded:
            print(f"  - {p.relative_to(ROOT)}")
    else:
        print("No .env files found. Copy .env.example → .env.local")
    print()
    for key in payload["configured"]:
        print(f"  [ok]   {key}")
    for key in payload["missing"]:
        print(f"  [MISS] {key}")
    print()
    if payload["all_configured"]:
        print("All vendor keys are set.")
        return 0
    print(f"Missing {len(payload['missing'])} key(s). Add to .env.local and restart npm run dev:all")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
