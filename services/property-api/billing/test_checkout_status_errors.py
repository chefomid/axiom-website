"""Tests for checkout-status error mapping and diagnostics."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

import stripe

from billing.stripe_service import (
    BILLING_AUTH_MISCONFIG,
    BILLING_SESSION_NOT_FOUND,
    BILLING_VERIFY_RETRY,
    CheckoutStatusError,
    map_checkout_status_exception,
)


class CheckoutStatusErrorMappingTests(unittest.TestCase):
    def test_anon_mismatch_remains_value_error_not_mapped_here(self) -> None:
        with self.assertRaises(ValueError):
            raise ValueError("Session does not belong to this user")

    def test_authentication_error_maps_to_503(self) -> None:
        exc = stripe.error.AuthenticationError("Invalid API Key")
        mapped = map_checkout_status_exception("cs_test_123456", "anon-1234", exc)
        self.assertEqual(mapped.status_code, 503)
        self.assertEqual(mapped.detail, BILLING_AUTH_MISCONFIG)

    def test_missing_session_maps_to_404(self) -> None:
        exc = stripe.error.InvalidRequestError(
            "No such checkout.session: cs_test_missing",
            param="id",
            code="resource_missing",
        )
        mapped = map_checkout_status_exception("cs_test_missing", "anon-1234", exc)
        self.assertEqual(mapped.status_code, 404)
        self.assertEqual(mapped.detail, BILLING_SESSION_NOT_FOUND)

    def test_api_connection_error_maps_to_503_retryable(self) -> None:
        exc = stripe.error.APIConnectionError("Network error")
        mapped = map_checkout_status_exception("cs_test_123456", "anon-1234", exc)
        self.assertEqual(mapped.status_code, 503)
        self.assertEqual(mapped.detail, BILLING_VERIFY_RETRY)

    def test_generic_api_error_maps_to_502(self) -> None:
        exc = stripe.error.APIError("Temporary Stripe outage")
        mapped = map_checkout_status_exception("cs_test_123456", "anon-1234", exc)
        self.assertEqual(mapped.status_code, 502)
        self.assertEqual(mapped.detail, BILLING_VERIFY_RETRY)

    @patch("billing.stripe_service.logger")
    def test_logs_sanitized_diagnostic_metadata(self, mock_logger) -> None:
        exc = stripe.error.APIError("Temporary Stripe outage")
        exc.request_id = "req_test_abc"
        exc.http_status = 500
        exc.code = "api_error"

        map_checkout_status_exception("cs_test_abcdefghijklmnop", "anon-id-uuid", exc)

        mock_logger.error.assert_called_once()
        message = mock_logger.error.call_args[0][0]
        self.assertEqual(message, "checkout-status failed route=%s session_id_prefix=%s anon_id_prefix=%s "
                         "exception_type=%s stripe_code=%s stripe_http_status=%s stripe_request_id=%s "
                         "exception_message=%s")
        args = mock_logger.error.call_args[0][1:]
        self.assertEqual(args[0], "/billing/checkout-status")
        self.assertEqual(args[1], "cs_test_abcd")
        self.assertEqual(args[2], "anon-id-")
        self.assertEqual(args[3], "APIError")
        self.assertEqual(args[4], "api_error")
        self.assertEqual(args[5], 500)
        self.assertEqual(args[6], "req_test_abc")


class CheckoutStatusRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_route_maps_anon_mismatch_to_403(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        with (
            patch("main.billing_enabled", return_value=True),
            patch("main.billing_db.is_ready", return_value=True),
            patch(
                "main.get_checkout_status",
                new=AsyncMock(side_effect=ValueError("Session does not belong to this user")),
            ),
        ):
            res = client.get(
                "/billing/checkout-status",
                params={"session_id": "cs_test_session", "anon_id": "wrong-anon-id"},
            )
        self.assertEqual(res.status_code, 403)
        self.assertIn("does not belong", res.json()["detail"])

    async def test_route_maps_stripe_failure_to_safe_502(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        with (
            patch("main.billing_enabled", return_value=True),
            patch("main.billing_db.is_ready", return_value=True),
            patch(
                "main.get_checkout_status",
                new=AsyncMock(side_effect=stripe.error.APIError("Temporary Stripe outage")),
            ),
            patch(
                "main.map_checkout_status_exception",
                return_value=CheckoutStatusError(502, BILLING_VERIFY_RETRY),
            ) as mock_map,
        ):
            res = client.get(
                "/billing/checkout-status",
                params={"session_id": "cs_test_session", "anon_id": "test-anon-id-1234"},
            )
        self.assertEqual(res.status_code, 502)
        self.assertEqual(res.json()["detail"], BILLING_VERIFY_RETRY)
        mock_map.assert_called_once()


if __name__ == "__main__":
    unittest.main()
