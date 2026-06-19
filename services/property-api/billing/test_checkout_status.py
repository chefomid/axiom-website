"""Tests for checkout session status polling and idempotent fulfillment."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from billing.stripe_service import fulfill_checkout_session, get_checkout_status, get_embed_checkout_credentials


class CheckoutStatusTests(unittest.IsolatedAsyncioTestCase):
    async def test_fulfill_checkout_session_credits_wallet(self) -> None:
        session = {
            "id": "cs_test_paid",
            "metadata": {
                "anon_id": "test-anon-id-1234",
                "pack_id": "pack_5",
                "credits": "55",
            },
        }
        with patch("billing.stripe_service.add_credits", new_callable=AsyncMock) as mock_add:
            mock_add.return_value = 55
            result = await fulfill_checkout_session(session)

        mock_add.assert_awaited_once_with(
            "test-anon-id-1234",
            55,
            reason="stripe_checkout:pack_5",
            reference_id="cs_test_paid",
        )
        self.assertEqual(result["credits_added"], 55)
        self.assertEqual(result["balance_credits"], 55)

    async def test_get_checkout_status_rejects_wrong_anon_id(self) -> None:
        session = MagicMock()
        session.get = lambda key, default=None: {
            "metadata": {"anon_id": "other-user"},
            "payment_status": "paid",
            "id": "cs_test",
        }.get(key, default)

        with patch("billing.stripe_service.stripe.checkout.Session.retrieve", return_value=session):
            with patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake"):
                with self.assertRaises(ValueError):
                    await get_checkout_status("cs_test", "test-anon-id-1234")

    async def test_get_checkout_status_fulfills_when_paid(self) -> None:
        session = MagicMock()
        session.get = lambda key, default=None: {
            "metadata": {
                "anon_id": "test-anon-id-1234",
                "credits": "47",
                "checkout_type": "quote",
                "purpose": "enrich",
            },
            "payment_status": "paid",
            "id": "cs_test_paid",
        }.get(key, default)

        with patch("billing.stripe_service.stripe.checkout.Session.retrieve", return_value=session):
            with patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake"):
                with patch(
                    "billing.stripe_service.fulfill_checkout_session",
                    new_callable=AsyncMock,
                ) as mock_fulfill:
                    mock_fulfill.return_value = {
                        "credits_added": 47,
                        "anon_id": "test-anon-id-1234",
                        "balance_credits": 47,
                    }
                    result = await get_checkout_status("cs_test_paid", "test-anon-id-1234")

        mock_fulfill.assert_awaited_once()
        self.assertEqual(result["status"], "paid")
        self.assertEqual(result["credits_added"], 47)
        self.assertEqual(result["balance_credits"], 47)

    async def test_get_checkout_status_open_without_fulfill(self) -> None:
        session = MagicMock()
        session.get = lambda key, default=None: {
            "metadata": {"anon_id": "test-anon-id-1234", "credits": "47"},
            "payment_status": "unpaid",
            "status": "open",
            "id": "cs_test_open",
        }.get(key, default)

        with patch("billing.stripe_service.stripe.checkout.Session.retrieve", return_value=session):
            with patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake"):
                with patch("billing.stripe_service.get_balance", new_callable=AsyncMock) as mock_balance:
                    with patch(
                        "billing.stripe_service.fulfill_checkout_session",
                        new_callable=AsyncMock,
                    ) as mock_fulfill:
                        mock_balance.return_value = 0
                        result = await get_checkout_status("cs_test_open", "test-anon-id-1234")

        mock_fulfill.assert_not_awaited()
        self.assertEqual(result["status"], "open")
        self.assertEqual(result["credits_added"], 0)

    async def test_get_checkout_status_paid_when_session_complete(self) -> None:
        session = MagicMock()
        session.get = lambda key, default=None: {
            "metadata": {
                "anon_id": "test-anon-id-1234",
                "credits": "47",
                "checkout_type": "quote",
                "purpose": "enrich",
            },
            "payment_status": "unpaid",
            "status": "complete",
            "id": "cs_test_complete",
        }.get(key, default)

        with patch("billing.stripe_service.stripe.checkout.Session.retrieve", return_value=session):
            with patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake"):
                with patch(
                    "billing.stripe_service.fulfill_checkout_session",
                    new_callable=AsyncMock,
                ) as mock_fulfill:
                    mock_fulfill.return_value = {
                        "credits_added": 0,
                        "anon_id": "test-anon-id-1234",
                        "balance_credits": 47,
                    }
                    result = await get_checkout_status("cs_test_complete", "test-anon-id-1234")

        mock_fulfill.assert_awaited_once()
        self.assertEqual(result["status"], "paid")
        self.assertEqual(result["balance_credits"], 47)

    async def test_get_checkout_status_paid_embedded_session_id(self) -> None:
        """Embedded desktop pay: status/fulfill works on embedded session A (not hosted B)."""
        session = MagicMock()
        session.get = lambda key, default=None: {
            "metadata": {
                "anon_id": "test-anon-id-1234",
                "pack_id": "pack_5",
                "credits": "55",
            },
            "payment_status": "paid",
            "status": "complete",
            "id": "cs_embedded_paid",
        }.get(key, default)

        with patch("billing.stripe_service.stripe.checkout.Session.retrieve", return_value=session):
            with patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake"):
                with patch(
                    "billing.stripe_service.fulfill_checkout_session",
                    new_callable=AsyncMock,
                ) as mock_fulfill:
                    mock_fulfill.return_value = {
                        "credits_added": 55,
                        "anon_id": "test-anon-id-1234",
                        "balance_credits": 55,
                    }
                    result = await get_checkout_status("cs_embedded_paid", "test-anon-id-1234")

        mock_fulfill.assert_awaited_once()
        self.assertEqual(result["status"], "paid")
        self.assertEqual(result["credits_added"], 55)

    async def test_get_checkout_status_idempotent_when_already_fulfilled(self) -> None:
        session = MagicMock()
        session.get = lambda key, default=None: {
            "metadata": {
                "anon_id": "test-anon-id-1234",
                "credits": "47",
                "checkout_type": "quote",
                "purpose": "enrich",
            },
            "payment_status": "paid",
            "id": "cs_test_paid",
        }.get(key, default)

        with patch("billing.stripe_service.stripe.checkout.Session.retrieve", return_value=session):
            with patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake"):
                with patch(
                    "billing.stripe_service.fulfill_checkout_session",
                    new_callable=AsyncMock,
                ) as mock_fulfill:
                    mock_fulfill.return_value = {
                        "credits_added": 0,
                        "anon_id": "test-anon-id-1234",
                        "balance_credits": 47,
                    }
                    result = await get_checkout_status("cs_test_paid", "test-anon-id-1234")

        self.assertEqual(result["status"], "paid")
        self.assertEqual(result["credits_added"], 0)
        self.assertEqual(result["balance_credits"], 47)

    async def test_get_checkout_status_parses_stripe_sdk_session_object(self) -> None:
        import stripe

        session = stripe.checkout.Session.construct_from(
            {
                "id": "cs_test_paid_sdk",
                "payment_status": "paid",
                "status": "complete",
                "metadata": {
                    "anon_id": "test-anon-id-1234",
                    "credits": "25",
                    "checkout_type": "quote",
                    "purpose": "enrich",
                },
            },
            "sk_test_fake",
        )

        with patch(
            "billing.stripe_service._retrieve_checkout_session",
            new_callable=AsyncMock,
            return_value=session,
        ):
            with patch("billing.stripe_service.add_credits", new_callable=AsyncMock) as mock_add:
                mock_add.return_value = 25
                result = await get_checkout_status("cs_test_paid_sdk", "test-anon-id-1234")

        self.assertEqual(result["status"], "paid")
        self.assertEqual(result["credits_added"], 25)
        mock_add.assert_awaited_once()


class CheckoutEmbedTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_embed_checkout_credentials(self) -> None:
        session = MagicMock()
        session.get = lambda key, default=None: {
            "metadata": {"anon_id": "test-anon-id-1234"},
            "ui_mode": "embedded",
            "client_secret": "cs_test_secret",
            "id": "cs_embedded",
            "status": "open",
            "amount_total": 470,
        }.get(key, default)

        with patch("billing.stripe_service.stripe.checkout.Session.retrieve", return_value=session):
            with patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake"):
                result = await get_embed_checkout_credentials("cs_embedded", "test-anon-id-1234")

        self.assertEqual(result["client_secret"], "cs_test_secret")
        self.assertEqual(result["charge_usd"], 4.7)
        self.assertEqual(result["status"], "open")

    async def test_get_embed_checkout_credentials_rejects_hosted(self) -> None:
        session = MagicMock()
        session.get = lambda key, default=None: {
            "metadata": {"anon_id": "test-anon-id-1234"},
            "ui_mode": "hosted",
            "client_secret": None,
        }.get(key, default)

        with patch("billing.stripe_service.stripe.checkout.Session.retrieve", return_value=session):
            with patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake"):
                with self.assertRaises(ValueError):
                    await get_embed_checkout_credentials("cs_hosted", "test-anon-id-1234")


if __name__ == "__main__":
    unittest.main()
