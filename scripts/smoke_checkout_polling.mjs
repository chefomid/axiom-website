#!/usr/bin/env node
/**
 * Smoke test: checkout-status API contract used by desktop QR polling.
 * Run from repo root: node scripts/smoke_checkout_polling.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

const API_BASE =
  process.env.VITE_PROPERTY_API_URL?.replace(/\/$/, '') ||
  process.env.PROPERTY_API_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:8000'

test('checkout-status requires session_id and anon_id', async () => {
  const res = await fetch(`${API_BASE}/billing/checkout-status?anon_id=test-anon-id-12345678`)
  assert.equal(res.status, 400)
})

test('checkout-resume requires paid session', async () => {
  const params = new URLSearchParams({
    session_id: 'cs_fake_not_paid',
    anon_id: 'test-anon-id-12345678',
  })
  const res = await fetch(`${API_BASE}/billing/checkout-resume?${params}`)
  assert.ok([402, 403, 502, 503].includes(res.status), `unexpected status ${res.status}`)
})

test('report confirmation rejects unknown id format', async () => {
  const res = await fetch(`${API_BASE}/reports/confirmation/not-a-valid-id`)
  assert.ok([404, 503].includes(res.status), `unexpected status ${res.status}`)
})
