#!/usr/bin/env node
/**
 * Contract tests: QR polls hosted session B; embedded onComplete verifies session A.
 * Run: node scripts/test_checkout_poll_targets.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createPollState,
  embeddedVerifySessionId,
  hostedPollSessionId,
} from '../src/hooks/checkoutPollTargets.js'

test('QR / main waiting loop uses hosted session as poll target', () => {
  const state = createPollState({
    hostedSessionId: 'cs_hosted_B',
    embeddedSessionId: 'cs_embedded_A',
  })
  assert.equal(hostedPollSessionId(state), 'cs_hosted_B')
  assert.notEqual(hostedPollSessionId(state), 'cs_embedded_A')
})

test('embedded onComplete verifies embedded session ID', () => {
  const state = createPollState({
    hostedSessionId: 'cs_hosted_B',
    embeddedSessionId: 'cs_embedded_A',
  })
  assert.equal(embeddedVerifySessionId(state), 'cs_embedded_A')
  assert.notEqual(embeddedVerifySessionId(state), 'cs_hosted_B')
})

test('poll state tracks both sessions without conflating targets', () => {
  const state = createPollState({
    hostedSessionId: 'cs_hosted_B',
    embeddedSessionId: 'cs_embedded_A',
    creditsToAdd: 47,
  })
  assert.equal(state.hostedSessionId, 'cs_hosted_B')
  assert.equal(state.embeddedSessionId, 'cs_embedded_A')
  assert.equal(state.completed, false)
})
