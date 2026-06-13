#!/usr/bin/env node
/**
 * Smoke-test careers apply templates and handler (no live Resend required).
 * Run from repo root: npm run smoke:careers-apply
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import handler from '../api/careers/apply.js'
import adminSubmissionsHandler from '../api/careers/admin/submissions.js'
import organizeInfoHandler from '../api/careers/organize/info.js'
import { getOrganizeModelInfo } from '../api/careers/organizeUtils.js'
import {
  generateReferenceId,
  renderApplicantConfirmation,
  renderInternalNotification,
} from '../api/careers/emailTemplates.js'

const APPLICANT = {
  fullName: 'Jane Doe',
  preferredName: 'Jane',
  email: 'jane.doe@example.com',
  phone: '555-0100',
  location: 'Austin, TX',
  resumeLink: '',
  linkedIn: 'https://linkedin.com/in/janedoe',
  portfolio: '',
  socialProfiles: '',
}

const SECTIONS = [
  {
    title: 'Basic Information',
    items: [
      { label: 'First name', answer: 'Jane' },
      { label: 'Last name', answer: 'Doe' },
      { label: 'Resume upload (optional)', answer: '(not answered)' },
    ],
  },
  {
    title: 'Motivation & Ambition',
    items: [
      {
        label: 'Why are you interested in AXIOM?',
        answer:
          'I want to build thoughtful software that helps teams understand risk more clearly and make better decisions every day.',
      },
    ],
  },
]

const SUBMITTED_AT = '2026-06-13T12:00:00.000Z'

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

function invokeAdminRoute(routeHandler, { method = 'GET', body = {}, headers = {}, url = '' } = {}) {
  return new Promise((resolve, reject) => {
    let statusCode = 200
    const res = {
      status(code) {
        statusCode = code
        return this
      },
      setHeader() {
        return this
      },
      json(payload) {
        resolve({ status: statusCode, body: payload })
      },
      send(payload) {
        resolve({ status: statusCode, body: payload })
      },
      end(payload) {
        resolve({ status: statusCode, body: payload })
      },
    }

    routeHandler({ method, body, headers, url }, res).catch(reject)
  })
}

describe('emailTemplates', () => {
  test('generateReferenceId matches AXM-YYYYMMDD-xxxxxx', () => {
    const ref = generateReferenceId(new Date('2026-06-13T12:00:00Z'))
    assert.match(ref, /^AXM-20260613-[a-z0-9]{6}$/)
  })

  test('applicant confirmation omits empty optional fields', () => {
    const email = renderApplicantConfirmation({
      applicant: APPLICANT,
      sections: SECTIONS,
      submittedAt: SUBMITTED_AT,
      referenceId: 'AXM-20260613-abc123',
    })
    assert.match(email.subject, /Application received/)
    assert.match(email.html, /Jane/)
    assert.match(email.html, /AXM-20260613-abc123/)
    assert.doesNotMatch(email.html, /\(not answered\)/)
    assert.doesNotMatch(email.text, /\(not answered\)/)
  })

  test('internal notification includes unanswered fields', () => {
    const email = renderInternalNotification({
      applicant: APPLICANT,
      sections: SECTIONS,
      submittedAt: SUBMITTED_AT,
      referenceId: 'AXM-20260613-abc123',
    })
    assert.match(email.subject, /New application \| Jane Doe/)
    assert.match(email.html, /\(not answered\)/)
    assert.match(email.text, /\(not answered\)/)
  })

  test('both templates include all section titles', () => {
    const applicantEmail = renderApplicantConfirmation({
      applicant: APPLICANT,
      sections: SECTIONS,
      submittedAt: SUBMITTED_AT,
      referenceId: 'AXM-20260613-abc123',
    })
    const internalEmail = renderInternalNotification({
      applicant: APPLICANT,
      sections: SECTIONS,
      submittedAt: SUBMITTED_AT,
      referenceId: 'AXM-20260613-abc123',
    })

    for (const section of SECTIONS) {
      assert.ok(applicantEmail.html.includes(section.title) || applicantEmail.html.includes(section.title.replace(/&/g, '&amp;')))
      assert.ok(internalEmail.html.includes(section.title) || internalEmail.html.includes(section.title.replace(/&/g, '&amp;')))
    }
  })

  test('internal notification links to careers admin', () => {
    const email = renderInternalNotification({
      applicant: APPLICANT,
      sections: SECTIONS,
      submittedAt: SUBMITTED_AT,
      referenceId: 'AXM-20260613-abc123',
    })
    assert.match(email.html, /\/careers\/admin/)
  })

  test('getOrganizeModelInfo prefers Nemotron when NVIDIA key is set', () => {
    const info = getOrganizeModelInfo({
      NVIDIA_API_KEY: 'nvapi-test',
      CAREERS_LLM_MODEL: 'nvidia/nemotron-mini-4b-instruct',
    })
    assert.equal(info.modelLabel, 'Nemotron Mini')
    assert.equal(info.configured, true)
  })

  test('getOrganizeModelInfo falls back to GPT-4o mini for OpenAI only', () => {
    const info = getOrganizeModelInfo({
      OPENAI_API_KEY: 'sk-test',
    })
    assert.equal(info.modelLabel, 'GPT-4o mini')
    assert.equal(info.provider, 'openai')
  })
})

describe('apply handler', () => {
  test('rejects empty payload with 400', async () => {
    const result = await invokeHandler({})
    assert.equal(result.status, 400)
  })

  test('rejects non-POST with 405', async () => {
    const result = await invokeHandler({ applicant: APPLICANT, sections: SECTIONS }, 'GET')
    assert.equal(result.status, 405)
  })

  test('honeypot returns ok without referenceId', async () => {
    const result = await invokeHandler({ website: 'spam-bot' })
    assert.equal(result.status, 200)
    assert.equal(result.body.ok, true)
  })

  test('valid payload without RESEND_API_KEY returns 503', async () => {
    const saved = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY

    try {
      const result = await invokeHandler({ applicant: APPLICANT, sections: SECTIONS })
      assert.equal(result.status, 503)
    } finally {
      if (saved !== undefined) process.env.RESEND_API_KEY = saved
    }
  })
})

const hasResendKey = Boolean(process.env.RESEND_API_KEY?.trim())

if (hasResendKey) {
  describe('apply handler (live Resend)', () => {
    test('valid payload returns referenceId shape', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = async (url, options) => {
        if (String(url).includes('api.resend.com')) {
          return { ok: true, text: async () => '' }
        }
        return originalFetch(url, options)
      }

      try {
        const result = await invokeHandler({ applicant: APPLICANT, sections: SECTIONS })
        assert.equal(result.status, 200)
        assert.equal(result.body.ok, true)
        assert.match(result.body.referenceId, /^AXM-\d{8}-[a-z0-9]{6}$/)
        assert.equal(result.body.confirmationSent, true)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
} else {
  console.log('SKIP: no RESEND_API_KEY (set for live handler mock test)')
}

describe('organize info', () => {
  test('GET returns model label', async () => {
    const saved = process.env.NVIDIA_API_KEY
    process.env.NVIDIA_API_KEY = 'nvapi-test'

    try {
      const result = await invokeAdminRoute(organizeInfoHandler, { method: 'GET' })
      assert.equal(result.status, 200)
      assert.equal(result.body.modelLabel, 'Nemotron Mini')
    } finally {
      if (saved !== undefined) process.env.NVIDIA_API_KEY = saved
      else delete process.env.NVIDIA_API_KEY
    }
  })
})

describe('admin auth', () => {
  test('submissions without token returns 401 when admin configured', async () => {
    const savedToken = process.env.CAREERS_ADMIN_TOKEN
    const savedDb = process.env.CAREERS_DATABASE_URL
    process.env.CAREERS_ADMIN_TOKEN = 'test-admin-token'
    process.env.CAREERS_DATABASE_URL = 'postgres://example'

    try {
      const result = await invokeAdminRoute(adminSubmissionsHandler, { method: 'GET', headers: {} })
      assert.equal(result.status, 401)
    } finally {
      if (savedToken !== undefined) process.env.CAREERS_ADMIN_TOKEN = savedToken
      else delete process.env.CAREERS_ADMIN_TOKEN
      if (savedDb !== undefined) process.env.CAREERS_DATABASE_URL = savedDb
      else delete process.env.CAREERS_DATABASE_URL
    }
  })

  test('submissions with valid token returns 503 without database', async () => {
    const savedToken = process.env.CAREERS_ADMIN_TOKEN
    const savedDb = process.env.CAREERS_DATABASE_URL
    process.env.CAREERS_ADMIN_TOKEN = 'test-admin-token'
    delete process.env.CAREERS_DATABASE_URL

    try {
      const result = await invokeAdminRoute(adminSubmissionsHandler, {
        method: 'GET',
        headers: { authorization: 'Bearer test-admin-token' },
      })
      assert.equal(result.status, 503)
    } finally {
      if (savedToken !== undefined) process.env.CAREERS_ADMIN_TOKEN = savedToken
      else delete process.env.CAREERS_ADMIN_TOKEN
      if (savedDb !== undefined) process.env.CAREERS_DATABASE_URL = savedDb
    }
  })
})
