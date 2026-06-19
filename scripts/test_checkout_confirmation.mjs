#!/usr/bin/env node
/**
 * Confirmation ID selection for dual-session checkout completion.
 * Run: node scripts/test_checkout_confirmation.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildCompleteResume } from '../src/hooks/checkoutPollTargets.js'

const storedResume = {
  resume: 'enrich',
  address: '123 Main St',
  selectedSources: ['attom_property'],
  confirmationId: 'AX-STORAGE',
}

test('embedded paid status wins over sessionStorage confirmation B', () => {
  const { resume, confirmationId, source } = buildCompleteResume(
    { ...storedResume, confirmationId: 'AX-STORAGE-B' },
    { status: 'paid', confirmation_id: 'AX-PAID-A' },
    'embedded',
  )
  assert.equal(confirmationId, 'AX-PAID-A')
  assert.equal(resume.confirmationId, 'AX-PAID-A')
  assert.equal(resume.address, '123 Main St')
  assert.equal(source, 'paid-embedded-status')
})

test('hosted paid status wins over sessionStorage confirmation A', () => {
  const { resume, confirmationId, source } = buildCompleteResume(
    { ...storedResume, confirmationId: 'AX-STORAGE-A' },
    { status: 'paid', confirmation_id: 'AX-PAID-B' },
    'hosted',
  )
  assert.equal(confirmationId, 'AX-PAID-B')
  assert.equal(resume.confirmationId, 'AX-PAID-B')
  assert.equal(resume.address, '123 Main St')
  assert.equal(source, 'paid-hosted-status')
})

test('falls back to sessionStorage when paid status has no confirmation_id', () => {
  const { resume, confirmationId, source } = buildCompleteResume(
    storedResume,
    { status: 'paid', balance_credits: 47, credits_added: 47 },
    'hosted',
  )
  assert.equal(confirmationId, 'AX-STORAGE')
  assert.equal(resume.confirmationId, 'AX-STORAGE')
  assert.equal(source, 'sessionStorage-fallback')
})

test('credit pack completion without confirmation_id', () => {
  const { resume, confirmationId, source } = buildCompleteResume(
    null,
    { status: 'paid', balance_credits: 55, credits_added: 55 },
    'hosted',
  )
  assert.equal(confirmationId, null)
  assert.equal(resume, null)
  assert.equal(source, 'none')
})

test('balance-only path uses sessionStorage when no status response', () => {
  const { confirmationId, source } = buildCompleteResume(storedResume, null, null)
  assert.equal(confirmationId, 'AX-STORAGE')
  assert.equal(source, 'sessionStorage-fallback')
})
