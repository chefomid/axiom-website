"""Tests for embedded vs hosted Stripe Checkout session creation."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from billing.stripe_service import create_checkout_session


class EmbeddedCheckoutSessionTests(unittest.TestCase):
    @patch("billing.stripe_service.stripe.checkout.Session.create")
    @patch("billing.stripe_service.frontend_url", return_value="http://127.0.0.1:5173")
    @patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake")
    def test_hosted_session_uses_success_and_cancel_urls(
        self,
        _mock_secret: MagicMock,
        _mock_frontend: MagicMock,
        mock_create: MagicMock,
    ) -> None:
        mock_create.return_value = MagicMock(id="cs_hosted", url="https://checkout.stripe.com/c/pay/cs_hosted")

        result = create_checkout_session(anon_id="test-anon-id-1234", pack_id="pack_5", embedded=False)

        params = mock_create.call_args.kwargs
        self.assertNotIn("ui_mode", params)
        self.assertIn("success_url", params)
        self.assertIn("cancel_url", params)
        self.assertNotIn("return_url", params)
        self.assertIn("session_id={CHECKOUT_SESSION_ID}", params["success_url"])
        self.assertEqual(result["url"], "https://checkout.stripe.com/c/pay/cs_hosted")
        self.assertIsNone(result["client_secret"])
        self.assertIsNone(result["phone_pay_url"])

    @patch("billing.stripe_service.stripe.checkout.Session.create")
    @patch("billing.stripe_service.frontend_url", return_value="http://127.0.0.1:5173")
    @patch("billing.stripe_service.stripe_secret_key", return_value="sk_test_fake")
    def test_embedded_session_uses_return_url_and_client_secret(
        self,
        _mock_secret: MagicMock,
        _mock_frontend: MagicMock,
        mock_create: MagicMock,
    ) -> None:
        mock_create.return_value = MagicMock(
            id="cs_embedded",
            url=None,
            client_secret="cs_test_secret",
        )

        result = create_checkout_session(anon_id="test-anon-id-1234", pack_id="pack_5", embedded=True)

        params = mock_create.call_args.kwargs
        self.assertEqual(params["ui_mode"], "embedded_page")
        self.assertIn("return_url", params)
        self.assertNotIn("success_url", params)
        self.assertNotIn("cancel_url", params)
        self.assertIn("session_id={CHECKOUT_SESSION_ID}", params["return_url"])
        self.assertEqual(result["client_secret"], "cs_test_secret")
        self.assertIsNone(result["url"])
        self.assertIn("/property-intelligence/pay", result["phone_pay_url"] or "")
        self.assertIn("session_id=cs_embedded", result["phone_pay_url"] or "")


if __name__ == "__main__":
    unittest.main()
