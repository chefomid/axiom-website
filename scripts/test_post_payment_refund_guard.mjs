#!/usr/bin/env node
/**
 * Post-payment refund eligibility guard.
 * Run: node scripts/test_post_payment_refund_guard.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isReportPostPaymentPurpose } from '../src/utils/postPaymentContext.js'

function showRefundEligible({ phase, context }) {
  return (
    phase === 'error' &&
    Boolean(context?.sessionId) &&
    Boolean(context?.generationAttempted) &&
    !context?.refundCompleted
  )
}

test('refund is not shown during generating phase', () => {
  assert.equal(
    showRefundEligible({
      phase: 'generating',
      context: { sessionId: 'cs_test', generationAttempted: true },
    }),
    false,
  )
})

test('refund is not shown on retryable mobile verification states', () => {
  assert.equal(
    showRefundEligible({
      phase: 'error',
      context: { sessionId: null, generationAttempted: false },
    }),
    false,
  )
})

test('refund is shown only on dedicated error phase with paid session context', () => {
  assert.equal(
    showRefundEligible({
      phase: 'error',
      context: {
        sessionId: 'cs_test_paid',
        generationAttempted: true,
        refundCompleted: false,
      },
    }),
    true,
  )
})

test('report post-payment purposes include enrich and batch only', () => {
  assert.equal(isReportPostPaymentPurpose('enrich'), true)
  assert.equal(isReportPostPaymentPurpose('batch_enrich'), true)
  assert.equal(isReportPostPaymentPurpose('discover'), false)
  assert.equal(isReportPostPaymentPurpose('pack_5'), false)
})
