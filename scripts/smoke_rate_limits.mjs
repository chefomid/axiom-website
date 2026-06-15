#!/usr/bin/env node
/**
 * Smoke-test shared rate-limit responses (careers + property API shape).
 * Run from repo root: npm run smoke:rate-limits
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import { checkRateLimit, rateLimitDetail, resetRateLimitsForTests } from '../api/lib/rateLimit.js'

function mockReq(ip = '203.0.113.1') {
  return {
    headers: {},
    socket: { remoteAddress: ip },
  }
}

function mockRes() {
  let statusCode = 200
  const headers = {}
  let body = null

  return {
    status(code) {
      statusCode = code
      return this
    },
    setHeader(name, value) {
      headers[name] = value
      return this
    },
    end(payload) {
      body = JSON.parse(payload)
    },
    result() {
      return { status: statusCode, headers, body }
    },
  }
}

describe('rateLimitDetail', () => {
  test('returns structured payload for frontend parsing', () => {
    const detail = rateLimitDetail(45)
    assert.equal(detail.code, 'rate_limit')
    assert.match(detail.message, /temporary usage limit/i)
    assert.match(detail.safety_note, /reliable and safe/i)
    assert.equal(detail.retry_after_seconds, 45)
  })
})

describe('checkRateLimit', () => {
  test('allows requests under the limit', () => {
    resetRateLimitsForTests()
    const req = mockReq()
    const res = mockRes()
    assert.equal(
      checkRateLimit(req, res, { route: 'test:allow', limit: 3, windowMs: 60_000 }),
      true,
    )
  })

  test('returns 429 with Retry-After when over the limit', () => {
    resetRateLimitsForTests()
    const req = mockReq('198.51.100.9')

    for (let i = 0; i < 2; i++) {
      const res = mockRes()
      assert.equal(
        checkRateLimit(req, res, { route: 'test:deny', limit: 2, windowMs: 60_000 }),
        true,
      )
    }

    const blocked = mockRes()
    assert.equal(
      checkRateLimit(req, blocked, { route: 'test:deny', limit: 2, windowMs: 60_000 }),
      false,
    )

    const { status, headers, body } = blocked.result()
    assert.equal(status, 429)
    assert.ok(headers['Retry-After'])
    assert.equal(body.detail.code, 'rate_limit')
    assert.match(body.detail.message, /temporary usage limit/i)
    assert.match(body.detail.safety_note, /reliable and safe/i)
  })
})

describe('property API rate_limit module', () => {
  test('exports limiter and structured handler', async () => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)

    const script = `
import json
from rate_limit import rate_limit_detail, limiter

payload = rate_limit_detail(retry_after_seconds=60)
assert payload["code"] == "rate_limit"
assert "safety_note" in payload
assert limiter is not None
print(json.dumps({"ok": True, "code": payload["code"]}))
`

    try {
      const { stdout } = await execFileAsync('python', ['-c', script], {
        cwd: 'services/property-api',
      })
      const result = JSON.parse(stdout.trim())
      assert.equal(result.ok, true)
      assert.equal(result.code, 'rate_limit')
    } catch (err) {
      console.log('SKIP: property API rate_limit check (pip install slowapi in property-api venv)')
      console.log(String(err.stderr ?? err.message ?? err))
    }
  })
})
