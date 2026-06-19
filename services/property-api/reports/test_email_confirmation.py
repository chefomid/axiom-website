"""Tests for report confirmation email delivery."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from reports.email_confirmation import (
    build_confirmation_email,
    format_address_without_zip,
    is_email_configured,
    property_label_from_payload,
)


class EmailTemplateTests(unittest.TestCase):
    def test_build_confirmation_email_includes_id_and_url(self) -> None:
        subject, body = build_confirmation_email(
            "ax-1234abcd",
            property_label="123 Main St, Austin, TX",
            site_url="https://www.axiompropertycasualty.com",
        )
        self.assertEqual(subject, "Your AXIOM report confirmation number")
        self.assertIn("AX-1234ABCD", body)
        self.assertIn("https://www.axiompropertycasualty.com/property-intelligence", body)
        self.assertIn("Report: 123 Main St, Austin, TX", body)
        self.assertIn("AXIOM Property & Casualty team", body)

    def test_format_address_without_zip(self) -> None:
        self.assertEqual(
            format_address_without_zip("123 Main St, Austin, TX 78701"),
            "123 Main St, Austin, TX",
        )
        self.assertEqual(
            format_address_without_zip("456 Oak Ave, Dallas, TX"),
            "456 Oak Ave, Dallas, TX",
        )

    def test_property_label_from_single_report_payload(self) -> None:
        label = property_label_from_payload(
            {"address_input": "456 Oak Ave, Dallas, TX 75201"},
        )
        self.assertEqual(label, "456 Oak Ave, Dallas, TX")

    def test_property_label_from_batch_payload(self) -> None:
        label = property_label_from_payload(
            {
                "batch_id": "BX-ABCDEF01",
                "locations": [{"record": {}}, {"record": {}}, {}],
            }
        )
        self.assertEqual(label, "2 location(s)")


class EmailConfiguredTests(unittest.TestCase):
    def test_is_email_configured_requires_credentials(self) -> None:
        with patch.dict(
            "os.environ",
            {"SMTP_USER": "contact@axiompropertycasualty.com", "SMTP_APP_PASSWORD": "secret"},
            clear=False,
        ):
            self.assertTrue(is_email_configured())
        with patch.dict("os.environ", {"SMTP_USER": "", "SMTP_APP_PASSWORD": ""}, clear=False):
            self.assertFalse(is_email_configured())


class EmailConfirmationEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_email_confirmation_happy_path(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        record = {
            "report_id": "AX-FEEDBEEF",
            "status": "enriched",
            "display_name": "123 Main St",
        }
        with (
            patch("main.billing_db.is_ready", return_value=True),
            patch("main.is_email_configured", return_value=True),
            patch(
                "main.billing_db.get_report_confirmation",
                new=AsyncMock(
                    return_value={
                        "confirmation_id": "AX-FEEDBEEF",
                        "status": "ready",
                        "payload": record,
                    }
                ),
            ),
            patch(
                "main.send_confirmation_email_async",
                new=AsyncMock(),
            ) as send_mock,
        ):
            res = client.post(
                "/reports/email-confirmation",
                json={"confirmation_id": "AX-FEEDBEEF", "email": "user@example.com"},
            )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"sent": True})
        send_mock.assert_awaited_once_with(
            "user@example.com",
            "AX-FEEDBEEF",
            property_label="123 Main St",
        )

    async def test_email_confirmation_uses_report_name(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        record = {"report_id": "AX-FEEDBEEF", "address_input": "123 Main St, Austin, TX 78701"}
        with (
            patch("main.billing_db.is_ready", return_value=True),
            patch("main.is_email_configured", return_value=True),
            patch(
                "main.billing_db.get_report_confirmation",
                new=AsyncMock(
                    return_value={
                        "confirmation_id": "AX-FEEDBEEF",
                        "status": "ready",
                        "payload": record,
                    }
                ),
            ),
            patch("main.send_confirmation_email_async", new=AsyncMock()) as send_mock,
        ):
            res = client.post(
                "/reports/email-confirmation",
                json={
                    "confirmation_id": "AX-FEEDBEEF",
                    "email": "user@example.com",
                    "report_name": "Downtown office",
                },
            )
        self.assertEqual(res.status_code, 200)
        send_mock.assert_awaited_once_with(
            "user@example.com",
            "AX-FEEDBEEF",
            property_label="Downtown office",
        )

    async def test_email_confirmation_unknown_id(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        with (
            patch("main.billing_db.is_ready", return_value=True),
            patch("main.is_email_configured", return_value=True),
            patch("main.billing_db.get_report_confirmation", new=AsyncMock(return_value=None)),
        ):
            res = client.post(
                "/reports/email-confirmation",
                json={"confirmation_id": "AX-00000001", "email": "user@example.com"},
            )
        self.assertEqual(res.status_code, 404)

    async def test_email_confirmation_pending(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        with (
            patch("main.billing_db.is_ready", return_value=True),
            patch("main.is_email_configured", return_value=True),
            patch(
                "main.billing_db.get_report_confirmation",
                new=AsyncMock(
                    return_value={
                        "confirmation_id": "AX-00000001",
                        "status": "pending",
                        "payload": {},
                    }
                ),
            ),
        ):
            res = client.post(
                "/reports/email-confirmation",
                json={"confirmation_id": "AX-00000001", "email": "user@example.com"},
            )
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()["detail"], "Report is still being prepared.")

    async def test_email_confirmation_smtp_not_configured(self) -> None:
        from fastapi.testclient import TestClient

        from main import app

        client = TestClient(app)
        with (
            patch("main.billing_db.is_ready", return_value=True),
            patch("main.is_email_configured", return_value=False),
        ):
            res = client.post(
                "/reports/email-confirmation",
                json={"confirmation_id": "AX-FEEDBEEF", "email": "user@example.com"},
            )
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.json()["detail"], "Email delivery is not available right now.")


if __name__ == "__main__":
    unittest.main()
