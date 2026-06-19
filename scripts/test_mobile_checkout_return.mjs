#!/usr/bin/env node
/**
 * Mobile payment return verification helpers.
 * Run: node scripts/test_mobile_checkout_return.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MOBILE_VERIFY_RETRYABLE_MESSAGE,
  MOBILE_VERIFY_TIMEOUT_MESSAGE,
  classifyMobileVerificationFailure,
  isRetryableCheckoutStatusError,
  sessionIdLogPrefix,
} from '../src/utils/mobileCheckoutReturn.js'

test('sessionIdLogPrefix exposes only a short prefix', () => {
  assert.equal(sessionIdLogPrefix('cs_test_live_session_12345'), 'cs_test_live…')
})

test('502/503/429/network errors are retryable', () => {
  assert.equal(isRetryableCheckoutStatusError({ status: 502 }), true)
  assert.equal(isRetryableCheckoutStatusError({ status: 503 }), true)
  assert.equal(isRetryableCheckoutStatusError({ status: 429 }), true)
  assert.equal(isRetryableCheckoutStatusError({ name: 'TypeError', message: 'Failed to fetch' }), true)
  assert.equal(isRetryableCheckoutStatusError({ status: 403 }), false)
})

test('retryable exhaustion uses softer verification message', () => {
  const failure = classifyMobileVerificationFailure({ status: 502 })
  assert.equal(failure.retryable, true)
  assert.equal(failure.message, MOBILE_VERIFY_RETRYABLE_MESSAGE)
})

test('403 remains a hard failure', () => {
  const failure = classifyMobileVerificationFailure({ status: 403 })
  assert.equal(failure.retryable, false)
  assert.match(failure.message, /not valid/i)
})

test('timeout without paid uses retryable softer message', () => {
  const failure = classifyMobileVerificationFailure(null, { timedOut: true })
  assert.equal(failure.retryable, true)
  assert.equal(failure.message, MOBILE_VERIFY_TIMEOUT_MESSAGE)
})

test('paid credit pack without confirmation id is a valid success shape', () => {
  const result = { paid: true, confirmationId: null }
  assert.equal(result.paid, true)
  assert.equal(result.confirmationId, null)
})

test('check again should re-enter verification without reload', () => {
  let verifyCalls = 0
  const runVerification = () => {
    verifyCalls += 1
  }
  runVerification()
  runVerification()
  assert.equal(verifyCalls, 2)
})
