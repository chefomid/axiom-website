"""Load API keys from property-api/.env and repo-root .env / .env.local."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

API_DIR = Path(__file__).resolve().parent
REPO_ROOT = API_DIR.parent.parent

# Later files override same variable names; keys only in earlier files are kept.
ENV_FILES = (
    REPO_ROOT / ".env",
    REPO_ROOT / ".env.local",
    API_DIR / ".env",
)


def load_project_env() -> list[Path]:
    loaded: list[Path] = []
    for path in ENV_FILES:
        if path.is_file():
            load_dotenv(path, override=True)
            loaded.append(path)
    return loaded


def env_key_status() -> dict[str, bool]:
    """Unique env_key values from registry sources → configured flag (values never returned)."""
    from registry_loader import get_sources

    keys: dict[str, bool] = {}
    for src in get_sources():
        env_key = src.get("env_key")
        if not env_key:
            continue
        keys.setdefault(env_key, bool(os.environ.get(env_key, "").strip()))
    return keys


def env_status_payload() -> dict:
    keys = env_key_status()
    configured = [k for k, ok in keys.items() if ok]
    missing = [k for k, ok in keys.items() if not ok]
    return {
        "configured": configured,
        "missing": missing,
        "all_configured": len(missing) == 0,
        "loaded_env_files": [str(p.relative_to(REPO_ROOT)) for p in ENV_FILES if p.is_file()],
    }
