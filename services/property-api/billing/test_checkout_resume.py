"""Tests for cross-device checkout resume persistence."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from billing import db as billing_db


class CheckoutResumeDbTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        billing_db._ready = False
        billing_db._pool = None
        billing_db._use_postgres = False
        billing_db._sqlite_path = Path(self._tmpdir.name) / "billing.sqlite"
        await billing_db.init_db()

    async def asyncTearDown(self) -> None:
        await billing_db.close_db()
        self._tmpdir.cleanup()

    async def test_save_and_load_checkout_resume(self) -> None:
        payload = {
            "address": "123 Main St, Austin, TX 78701",
            "selected_sources": ["rentcast_property"],
            "source_urls": {},
            "confirmed_price_usd": 12.5,
        }
        await billing_db.save_checkout_resume(
            "cs_test_resume",
            "test-anon-id-1234",
            "enrich",
            payload,
        )
        loaded = await billing_db.get_checkout_resume("cs_test_resume", "test-anon-id-1234")
        self.assertIsNotNone(loaded)
        assert loaded is not None
        self.assertEqual(loaded["purpose"], "enrich")
        self.assertEqual(loaded["payload"]["address"], payload["address"])
        self.assertEqual(loaded["payload"]["selected_sources"], payload["selected_sources"])

    async def test_rejects_wrong_anon_id(self) -> None:
        await billing_db.save_checkout_resume(
            "cs_test_resume_2",
            "test-anon-id-1234",
            "enrich",
            {"address": "123 Main St"},
        )
        loaded = await billing_db.get_checkout_resume("cs_test_resume_2", "other-anon-id-9999")
        self.assertIsNone(loaded)

    async def test_report_confirmation_pending_ready_lookup(self) -> None:
        confirmation_id = "AX-1234ABCD"
        await billing_db.save_report_confirmation_pending(
            confirmation_id,
            "test-anon-id-1234",
            {"purpose": "enrich", "address": "123 Main St"},
        )
        pending = await billing_db.get_report_confirmation(confirmation_id)
        self.assertIsNotNone(pending)
        assert pending is not None
        self.assertEqual(pending["status"], "pending")

        record = {"report_id": confirmation_id, "status": "enriched"}
        await billing_db.update_report_confirmation(confirmation_id, status="ready", payload=record)
        ready = await billing_db.get_report_confirmation(confirmation_id)
        assert ready is not None
        self.assertEqual(ready["status"], "ready")
        self.assertEqual(ready["payload"]["report_id"], confirmation_id)


class CheckoutResumeEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_checkout_resume_requires_paid_status(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        with (
            patch("main.billing_enabled", return_value=True),
            patch("main.billing_db.is_ready", return_value=True),
            patch(
                "main.get_checkout_status",
                new=AsyncMock(return_value={"status": "open", "balance_credits": 0, "credits_added": 0}),
            ),
        ):
            res = client.get(
                "/billing/checkout-resume",
                params={"session_id": "cs_open", "anon_id": "test-anon-id-1234"},
            )
        self.assertEqual(res.status_code, 402)

    async def test_checkout_resume_returns_payload_when_paid(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        resume_payload = {
            "address": "123 Main St, Austin, TX 78701",
            "addresses": [],
            "selected_sources": ["rentcast_property"],
            "source_urls": {},
            "confirmed_price_usd": 9.5,
        }
        with (
            patch("main.billing_enabled", return_value=True),
            patch("main.billing_db.is_ready", return_value=True),
            patch(
                "main.get_checkout_status",
                new=AsyncMock(return_value={"status": "paid", "balance_credits": 50, "credits_added": 50}),
            ),
            patch(
                "main.billing_db.get_checkout_resume",
                new=AsyncMock(return_value={"purpose": "enrich", "payload": resume_payload}),
            ),
        ):
            res = client.get(
                "/billing/checkout-resume",
                params={"session_id": "cs_paid", "anon_id": "test-anon-id-1234"},
            )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["purpose"], "enrich")
        self.assertEqual(data["resume"]["address"], resume_payload["address"])

    async def test_checkout_status_includes_confirmation_id(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        resume_payload = {
            "address": "123 Main St, Austin, TX 78701",
            "confirmation_id": "AX-ABCDEF01",
        }
        with (
            patch("main.billing_enabled", return_value=True),
            patch("main.billing_db.is_ready", return_value=True),
            patch(
                "main.get_checkout_status",
                new=AsyncMock(return_value={"status": "paid", "balance_credits": 50, "credits_added": 50}),
            ),
            patch(
                "main.billing_db.get_checkout_resume",
                new=AsyncMock(return_value={"purpose": "enrich", "payload": resume_payload}),
            ),
        ):
            res = client.get(
                "/billing/checkout-status",
                params={"session_id": "cs_paid", "anon_id": "test-anon-id-1234"},
            )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["confirmation_id"], "AX-ABCDEF01")

    async def test_report_confirmation_lookup(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        record = {"report_id": "AX-FEEDBEEF", "status": "enriched", "address_input": "123 Main St"}
        with (
            patch("main.billing_db.is_ready", return_value=True),
            patch(
                "main.billing_db.get_report_confirmation",
                new=AsyncMock(
                    return_value={
                        "confirmation_id": "AX-FEEDBEEF",
                        "anon_id": "test-anon-id-1234",
                        "status": "ready",
                        "payload": record,
                    }
                ),
            ),
        ):
            res = client.get("/reports/confirmation/AX-FEEDBEEF")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ready")
        self.assertEqual(data["record"]["report_id"], "AX-FEEDBEEF")

    async def test_report_confirmation_pending_returns_202(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        with (
            patch("main.billing_db.is_ready", return_value=True),
            patch(
                "main.billing_db.get_report_confirmation",
                new=AsyncMock(
                    return_value={
                        "confirmation_id": "AX-00000001",
                        "anon_id": "test-anon-id-1234",
                        "status": "pending",
                        "payload": {"purpose": "enrich"},
                    }
                ),
            ),
        ):
            res = client.get("/reports/confirmation/AX-00000001")
        self.assertEqual(res.status_code, 202)
        data = res.json()
        self.assertEqual(data["status"], "pending")


if __name__ == "__main__":
    unittest.main()
