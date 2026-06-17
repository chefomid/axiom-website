"""Tests for production-safe user messaging."""

from __future__ import annotations

import os
from unittest.mock import patch

from public_messages import is_production_deploy, public_run_message, public_warning_message


def test_public_run_message_strips_internal_copy_on_render():
    with patch.dict(os.environ, {"RENDER": "true"}, clear=False):
        assert is_production_deploy() is True
        assert public_run_message("RENTCAST_API_KEY not configured") is None
        assert public_run_message("Flood zone lookup failed") == "Flood zone lookup failed"


def test_public_warning_message_strips_env_hints():
    with patch.dict(os.environ, {"RENDER": "true"}, clear=False):
        msg = "ATTOM is not configured on this server — Add ATTOM_API_KEY to .env"
        assert public_warning_message(msg) is None


def test_dev_keeps_internal_messages():
    with patch.dict(os.environ, {"RENDER": ""}, clear=False):
        os.environ.pop("FRONTEND_URL", None)
        assert is_production_deploy() is False
        assert public_run_message("RENTCAST_API_KEY not configured") == "RENTCAST_API_KEY not configured"
