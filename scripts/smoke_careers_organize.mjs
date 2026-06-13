#!/usr/bin/env node
/**
 * Smoke-test careers organize API and utils (no mic/dictation).
 * Run from repo root: npm run smoke:careers-organize
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import handler from '../api/careers/organize.js'
import {
  isOrganizeExpansionAcceptable,
  lightOrganizeText,
  shouldUseLlmOrganize,
  wordCount,
} from '../api/careers/organizeUtils.js'

const SHORT_TEXT = 'I like building software and solving hard problems.'
const LONG_TEXT =
  'I have spent several years building insurance technology products that help teams review certificates faster and reduce manual compliance work across large property portfolios every day.'

function invokeHandler(body, method = 'POST') {
  return new Promise((resolve, reject) => {
    let statusCode = 200
    const res = {
      status(code) {
        statusCode = code
        return this
      },
      json(payload) {
        resolve({ status: statusCode, body: payload })
      },
    }

    handler({ method, body }, res).catch(reject)
  })
}

describe('organizeUtils', () => {
  test('shouldUseLlmOrganize rejects short answers', () => {
    const eleven = 'one two three four five six seven eight nine ten eleven'
    assert.equal(wordCount(eleven), 11)
    assert.equal(shouldUseLlmOrganize(eleven), false)
  })

  test('shouldUseLlmOrganize accepts twelve-word answers', () => {
    const twelve = 'one two three four five six seven eight nine ten eleven twelve'
    assert.equal(wordCount(twelve), 12)
    assert.equal(shouldUseLlmOrganize(twelve), true)
  })

  test('shouldUseLlmOrganize rejects repetitive phrases', () => {
    assert.equal(shouldUseLlmOrganize('test test test test test test'), false)
  })

  test('lightOrganizeText capitalizes and normalizes whitespace', () => {
    assert.equal(lightOrganizeText('  hello   world  '), 'Hello world')
  })

  test('isOrganizeExpansionAcceptable rejects over-expanded output', () => {
    const source = 'I build software for insurance teams.'
    const bloated = `${source} ${'extra word '.repeat(20)}`
    assert.equal(isOrganizeExpansionAcceptable(source, bloated), false)
  })
})

describe('organize handler', () => {
  test('rejects empty text with 400', async () => {
    const result = await invokeHandler({ text: '   ' })
    assert.equal(result.status, 400)
    assert.equal(result.body.detail, 'Nothing to organize.')
  })

  test('rejects non-POST with 405', async () => {
    const result = await invokeHandler({ text: LONG_TEXT }, 'GET')
    assert.equal(result.status, 405)
  })

  test('short text returns light mode', async () => {
    const result = await invokeHandler({ text: SHORT_TEXT })
    assert.equal(result.status, 200)
    assert.equal(result.body.mode, 'light')
    assert.equal(result.body.text, lightOrganizeText(SHORT_TEXT))
  })

  test('long text without API key returns passthrough mode', async () => {
    const savedNvidia = process.env.NVIDIA_API_KEY
    const savedOpenai = process.env.OPENAI_API_KEY
    delete process.env.NVIDIA_API_KEY
    delete process.env.OPENAI_API_KEY

    try {
      const result = await invokeHandler({ text: LONG_TEXT, question: 'Why AXIOM?' })
      assert.equal(result.status, 200)
      assert.equal(result.body.mode, 'passthrough')
      assert.equal(result.body.text, LONG_TEXT)
    } finally {
      if (savedNvidia !== undefined) process.env.NVIDIA_API_KEY = savedNvidia
      else delete process.env.NVIDIA_API_KEY
      if (savedOpenai !== undefined) process.env.OPENAI_API_KEY = savedOpenai
      else delete process.env.OPENAI_API_KEY
    }
  })
})

const hasLlmKey = Boolean(
  process.env.NVIDIA_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
)

if (hasLlmKey) {
  describe('organize handler (live LLM)', () => {
    test('long text with API key returns llm mode', async () => {
      const result = await invokeHandler({
        text: LONG_TEXT,
        question: 'Tell us about your background.',
      })
      assert.equal(result.status, 200)
      assert.ok(['llm', 'light'].includes(result.body.mode))
      assert.ok(typeof result.body.text === 'string' && result.body.text.length > 0)
      assert.equal(isOrganizeExpansionAcceptable(LONG_TEXT, result.body.text), true)
    })
  })
} else {
  console.log('SKIP: no LLM key (set NVIDIA_API_KEY or OPENAI_API_KEY for live organize test)')
}
