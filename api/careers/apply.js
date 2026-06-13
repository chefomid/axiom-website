/**
 * Careers application intake — persists via email delivery through Resend.
 *
 * Env (Vercel):
 *   RESEND_API_KEY       — required
 *   CAREERS_TO_EMAIL     — internal recipient (default axiom_coi@outlook.com)
 *   CAREERS_FROM_EMAIL   — verified sender
 *   CAREERS_SITE_URL     — logo + footer links (default production URL)
 *   CAREERS_REPLY_EMAIL  — optional reply-to on applicant confirmation
 */

import {
  generateReferenceId,
  getCareersSiteUrl,
  renderApplicantConfirmation,
  renderInternalNotification,
} from './emailTemplates.js'
import { insertSubmission, isCareersDbEnabled } from './db.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

const TO_EMAIL = process.env.CAREERS_TO_EMAIL ?? 'axiom_coi@outlook.com'
const FROM_EMAIL = process.env.CAREERS_FROM_EMAIL ?? 'AXIOM Careers <onboarding@resend.dev>'
const REPLY_EMAIL = process.env.CAREERS_REPLY_EMAIL ?? TO_EMAIL
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

async function sendResendEmail(apiKey, emailBody) {
  const upstream = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailBody),
  })

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    throw new Error(`Resend delivery failed (${upstream.status}): ${detail}`)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Method not allowed' })
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

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    res.status(503).json({
      detail:
        'Application delivery is not configured. Set RESEND_API_KEY in the Vercel project settings.',
    })
    return
  }

  const applicant = {
    fullName: String(body.applicant.fullName).trim(),
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
  const siteUrl = getCareersSiteUrl()

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

  const internalEmail = renderInternalNotification({
    applicant,
    sections: body.sections,
    submittedAt,
    referenceId,
    siteUrl,
  })

  const applicantEmail = renderApplicantConfirmation({
    applicant,
    sections: body.sections,
    submittedAt,
    referenceId,
    siteUrl,
  })

  try {
    if (isCareersDbEnabled()) {
      try {
        await insertSubmission({
          referenceId,
          submittedAt,
          applicant,
          sections: body.sections,
          attachment,
        })
      } catch (err) {
        console.error(`Careers DB insert failed: ${err?.message ?? err}`)
      }
    }

    const internalBody = {
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: applicant.email,
      subject: internalEmail.subject,
      html: internalEmail.html,
      text: internalEmail.text,
    }
    if (attachment) {
      internalBody.attachments = [attachment]
    }

    await sendResendEmail(apiKey, internalBody)

    let confirmationSent = false
    try {
      await sendResendEmail(apiKey, {
        from: FROM_EMAIL,
        to: [applicant.email],
        reply_to: REPLY_EMAIL,
        subject: applicantEmail.subject,
        html: applicantEmail.html,
        text: applicantEmail.text,
      })
      confirmationSent = true
    } catch (err) {
      console.error(`Applicant confirmation failed: ${err?.message ?? err}`)
    }

    res.status(200).json({ ok: true, referenceId, confirmationSent })
  } catch (err) {
    console.error(`Careers email send failed: ${err?.message ?? err}`)
    res.status(502).json({
      detail: 'The application could not be delivered. Please try again in a moment.',
    })
  }
}
