"""Tests for quote-based checkout pricing."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from billing.credits import credits_to_usd, usd_to_credits
from billing.quote_checkout import STRIPE_MIN_USD, compute_checkout_pricing


class CreditsConversionTests(unittest.TestCase):
    def test_credits_to_usd(self) -> None:
        self.assertEqual(credits_to_usd(0), 0.0)
        self.assertEqual(credits_to_usd(34), 3.40)
        self.assertEqual(credits_to_usd(44), 4.40)

    def test_usd_to_credits_rounds_up(self) -> None:
        self.assertEqual(usd_to_credits(4.37), 44)


class QuoteCheckoutPricingTests(unittest.IsolatedAsyncioTestCase):
    async def test_discover_preview_is_free(self) -> None:
        with patch("billing.quote_checkout.get_balance", new=AsyncMock(return_value=0)):
            result = await compute_checkout_pricing(
                purpose="discover",
                address="123 Main St, Austin, TX 78701",
                selected_sources=[],
                anon_id="test-anon-id-1234",
            )
        self.assertTrue(result["sufficient"])
        self.assertEqual(result["user_price_usd"], 0.0)
        self.assertEqual(result["charge_usd"], 0.0)
        self.assertEqual(result["credits_to_add"], 0)

    async def test_sufficient_balance_no_charge(self) -> None:
        with patch("billing.quote_checkout.get_balance", new=AsyncMock(return_value=99999)):
            result = await compute_checkout_pricing(
                purpose="discover",
                address="123 Main St, Austin, TX 78701",
                selected_sources=[],
                anon_id="test-anon-id-1234",
            )
        self.assertTrue(result["sufficient"])
        self.assertEqual(result["charge_usd"], 0.0)
        self.assertEqual(result["credits_to_add"], 0)

    async def test_stripe_minimum_bump_does_not_apply_to_free_discover(self) -> None:
        with patch("billing.quote_checkout.get_balance", new=AsyncMock(return_value=0)):
            result = await compute_checkout_pricing(
                purpose="discover",
                address="123 Main St, Austin, TX 78701",
                selected_sources=[],
                anon_id="test-anon-id-1234",
            )
        self.assertEqual(result["charge_usd"], 0.0)
        self.assertEqual(result["credits_to_add"], 0)

    async def test_enrich_uses_quote(self) -> None:
        fake_quote = {"totals": {"user_price_usd": 4.37}}
        with patch("billing.quote_checkout.get_balance", new=AsyncMock(return_value=0)):
            with patch(
                "billing.quote_checkout._pricing_for_enrich",
                new=AsyncMock(return_value=(4.37, 44)),
            ):
                result = await compute_checkout_pricing(
                    purpose="enrich",
                    address="123 Main St, Austin, TX 78701",
                    selected_sources=["fema"],
                    anon_id="test-anon-id-1234",
                )
        self.assertFalse(result["sufficient"])
        self.assertEqual(result["charge_usd"], 4.37)
        self.assertEqual(result["credits_to_add"], 44)


if __name__ == "__main__":
    unittest.main()
