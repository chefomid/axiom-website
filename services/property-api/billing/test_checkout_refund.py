"""Tests for checkout payment summary and refund endpoints."""

from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from billing import db as billing_db
from billing.stripe_service import get_checkout_payment_summary, refund_checkout_session


def _paid_session(*, anon_id: str = "test-anon-id-1234", session_id: str = "cs_test_paid") -> MagicMock:
    session = MagicMock()
    session.get = lambda key, default=None: {
        "id": session_id,
        "metadata": {"anon_id": anon_id, "credits": "47", "checkout_type": "quote", "purpose": "enrich"},
        "payment_status": "paid",
        "status": "complete",
        "amount_total": 245,
        "currency": "usd",
        "payment_intent": {
            "id": "pi_test_123",
            "latest_charge": {
                "payment_method_details": {
                    "card": {"brand": "visa", "last4": "4242"},
                }
            },
        },
    }.get(key, default)
    return session


class CheckoutPaymentSummaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_summary_rejects_wrong_anon_id(self) -> None:
        session = _paid_session(anon_id="other-user")
        with patch("billing.stripe_service._retrieve_checkout_session", new_callable=AsyncMock) as mock_retrieve:
            mock_retrieve.return_value = session
            with self.assertRaises(ValueError):
                await get_checkout_payment_summary("cs_test_paid", "test-anon-id-1234")

    async def test_summary_returns_last4_without_full_pm_id(self) -> None:
        session = _paid_session()
        with patch("billing.stripe_service._retrieve_checkout_session", new_callable=AsyncMock) as mock_retrieve:
            mock_retrieve.return_value = session
            result = await get_checkout_payment_summary("cs_test_paid", "test-anon-id-1234")

        self.assertEqual(result["brand"], "visa")
        self.assertEqual(result["last4"], "4242")
        self.assertEqual(result["amount_usd"], 2.45)
        self.assertNotIn("payment_method", result)


class CheckoutRefundTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        billing_db._ready = False
        billing_db._pool = None
        billing_db._use_postgres = False
        billing_db._sqlite_path = Path(self._tmpdir.name) / "billing.sqlite"
        await asyncio.to_thread(billing_db._init_sqlite, billing_db._sqlite_path)
        billing_db._ready = True

    async def asyncTearDown(self) -> None:
        await billing_db.close_db()
        self._tmpdir.cleanup()

    async def test_refund_rejects_wrong_anon_id(self) -> None:
        session = _paid_session(anon_id="other-user")
        with patch("billing.stripe_service._retrieve_checkout_session", new_callable=AsyncMock) as mock_retrieve:
            mock_retrieve.return_value = session
            with self.assertRaises(ValueError):
                await refund_checkout_session("cs_test_paid", "test-anon-id-1234")

    async def test_refund_rejects_unpaid_session(self) -> None:
        session = MagicMock()
        session.get = lambda key, default=None: {
            "id": "cs_test_open",
            "metadata": {"anon_id": "test-anon-id-1234", "credits": "47"},
            "payment_status": "unpaid",
            "status": "open",
        }.get(key, default)
        with patch("billing.stripe_service._retrieve_checkout_session", new_callable=AsyncMock) as mock_retrieve:
            mock_retrieve.return_value = session
            with self.assertRaises(ValueError) as ctx:
                await refund_checkout_session("cs_test_open", "test-anon-id-1234")
        self.assertIn("not paid", str(ctx.exception))

    async def test_refund_rejects_without_ledger_fulfillment(self) -> None:
        session = _paid_session()
        with patch("billing.stripe_service._retrieve_checkout_session", new_callable=AsyncMock) as mock_retrieve:
            mock_retrieve.return_value = session
            with patch("billing.stripe_service.get_ledger_credit_add", new_callable=AsyncMock) as mock_ledger:
                mock_ledger.return_value = None
                with self.assertRaises(ValueError) as ctx:
                    await refund_checkout_session("cs_test_paid", "test-anon-id-1234")
        self.assertIn("No fulfilled payment", str(ctx.exception))

    async def test_successful_refund_is_idempotent(self) -> None:
        session_id = "cs_test_refund_unique"
        session = _paid_session(session_id=session_id)
        await billing_db.add_credits(
            "test-anon-id-1234",
            47,
            reason="stripe_checkout:quote:enrich",
            reference_id=session_id,
        )

        refund_obj = MagicMock()
        refund_obj.id = "re_test_refund_1"

        with patch("billing.stripe_service._retrieve_checkout_session", new_callable=AsyncMock) as mock_retrieve:
            mock_retrieve.return_value = session
            with patch("billing.stripe_service.stripe.Refund.create", return_value=refund_obj):
                result = await refund_checkout_session(session_id, "test-anon-id-1234")

        self.assertTrue(result["ok"])
        self.assertEqual(result["refund_id"], "re_test_refund_1")
        self.assertEqual(result["last4"], "4242")
        balance = await billing_db.get_balance("test-anon-id-1234")
        self.assertEqual(balance, 0)

        with patch("billing.stripe_service._retrieve_checkout_session", new_callable=AsyncMock):
            with self.assertRaises(ValueError) as ctx:
                await refund_checkout_session(session_id, "test-anon-id-1234")
        self.assertEqual(str(ctx.exception), "already_refunded")


class CheckoutRefundEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_refund_route_rejects_wrong_anon_id(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        session = _paid_session(anon_id="other-user")
        with patch("main.billing_enabled", return_value=True):
            with patch("main.billing_db.is_ready", return_value=True):
                with patch(
                    "billing.stripe_service._retrieve_checkout_session",
                    new_callable=AsyncMock,
                ) as mock_retrieve:
                    mock_retrieve.return_value = session
                    client = TestClient(app)
                    res = client.post(
                        "/billing/refund-checkout",
                        json={"session_id": "cs_test_paid", "anon_id": "test-anon-id-1234"},
                    )
        self.assertEqual(res.status_code, 403)

    async def test_payment_summary_route_returns_card_fields(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        session = _paid_session()
        with patch("main.billing_enabled", return_value=True):
            with patch("main.billing_db.is_ready", return_value=True):
                with patch(
                    "billing.stripe_service._retrieve_checkout_session",
                    new_callable=AsyncMock,
                ) as mock_retrieve:
                    mock_retrieve.return_value = session
                    client = TestClient(app)
                    res = client.get(
                        "/billing/checkout-payment-summary",
                        params={"session_id": "cs_test_paid", "anon_id": "test-anon-id-1234"},
                    )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["last4"], "4242")
        self.assertEqual(data["brand"], "visa")


if __name__ == "__main__":
    unittest.main()
