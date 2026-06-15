/**
 * Careers application intake. Persists submissions for admin review (no email required).
 *
 * Env:
 *   CAREERS_DATABASE_URL , Postgres (production / optional local)
 *   Local dev without DB uses .careers-data/ when NODE_ENV=development
 */

import { generateReferenceId } from './emailTemplates.js'
import {
  careersStorageNotConfiguredMessage,
  ensureStorageReady,
  insertSubmission,
  isCareersStorageEnabled,
} from './store.js'
import { checkRateLimit } from '../lib/rateLimit.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

import { CAREERS_OPEN_ROLE } from './roles.js'

const OPEN_ROLE = CAREERS_OPEN_ROLE

function badPayload(body) {
  if (!body || typeof body !== 'object') return 'Invalid payload.'
  const { applicant, sections } = body
  if (!applicant || typeof applicant !== 'object') return 'Missing applicant details.'
  if (!applicant.fullName || !String(applicant.fullName).trim()) return 'Full name is required.'
  if (!applicant.email || !EMAIL_PATTERN.test(String(applicant.email).trim()))
    return 'A valid email is required.'
  if (!Array.isArray(sections) || sections.length === 0) return 'Missing application sections.'
  for (const section of sections) {
    if (!section || typeof section.title !== 'string' || !Array.isArray(section.items))
      return 'Malformed application section.'
    for (const item of section.items) {
      if (!item || typeof item.label !== 'string' || typeof item.answer !== 'string')
        return 'Malformed application answer.'
    }
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }

  if (
    !checkRateLimit(req, res, {
      route: 'careers:apply',
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })
  ) {
    return
  }

  const body = req.body

  if (body && typeof body === 'object' && body.website) {
    res.status(200).json({ ok: true })
    return
  }

  const problem = badPayload(body)
  if (problem) {
    res.status(400).json({ detail: problem })
    return
  }

  if (!isCareersStorageEnabled()) {
    res.status(503).json({ detail: careersStorageNotConfiguredMessage() })
    return
  }

  const applicant = {
    fullName: String(body.applicant.fullName).trim(),
    roleApplied: String(body.applicant.roleApplied ?? '').trim() || OPEN_ROLE,
    preferredName: String(body.applicant.preferredName ?? '').trim(),
    email: String(body.applicant.email).trim(),
    phone: String(body.applicant.phone ?? '').trim(),
    location: String(body.applicant.location ?? '').trim(),
    resumeLink: String(body.applicant.resumeLink ?? '').trim(),
    linkedIn: String(body.applicant.linkedIn ?? '').trim(),
    portfolio: String(body.applicant.portfolio ?? '').trim(),
    socialProfiles: String(body.applicant.socialProfiles ?? '').trim(),
  }

  const submittedAt = new Date().toISOString()
  const referenceId = generateReferenceId(new Date(submittedAt))

  const attachment =
    body.attachment &&
    typeof body.attachment === 'object' &&
    typeof body.attachment.filename === 'string' &&
    typeof body.attachment.content === 'string'
      ? {
          filename: body.attachment.filename,
          content: body.attachment.content,
        }
      : null

  try {
    await ensureStorageReady()

    const row = await insertSubmission({
      referenceId,
      submittedAt,
      applicant,
      sections: body.sections,
      attachment,
    })

    if (!row) {
      res.status(503).json({ detail: careersStorageNotConfiguredMessage() })
      return
    }

    res.status(200).json({ ok: true, referenceId })
  } catch (err) {
    console.error(`Careers submission save failed: ${err?.message ?? err}`)
    res.status(502).json({
      detail: 'The application could not be saved. Please try again in a moment.',
    })
  }
}
