/**
 * Careers application intake, formats the submission into a readable email
 * and delivers it via the Resend REST API. No storage; email only.
 *
 * Env (Vercel):
 *   RESEND_API_KEY    , required
 *   CAREERS_TO_EMAIL  , optional, defaults to axiom_coi@outlook.com
 *   CAREERS_FROM_EMAIL, optional, defaults to Resend's shared onboarding sender
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

const TO_EMAIL = process.env.CAREERS_TO_EMAIL ?? 'axiom_coi@outlook.com'
const FROM_EMAIL = process.env.CAREERS_FROM_EMAIL ?? 'AXIOM Careers <onboarding@resend.dev>'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>')
}

function renderHtml(applicant, sections, submittedAt) {
  const meta = [
    ['Name', applicant.fullName],
    ['Preferred name', applicant.preferredName],
    ['Email', applicant.email],
    ['Phone', applicant.phone],
    ['Location', applicant.location],
    ['Resume link', applicant.resumeLink],
    ['LinkedIn', applicant.linkedIn],
    ['Portfolio', applicant.portfolio],
    ['Social profiles', applicant.socialProfiles],
    ['Submitted', submittedAt],
  ]
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111;font-size:14px;">${escapeHtml(v)}</td></tr>`,
    )
    .join('')

  const body = sections
    .map(section => {
      const items = section.items
        .map(
          item =>
            `<div style="margin:0 0 18px;">
              <p style="margin:0 0 4px;color:#555;font-size:13px;font-weight:600;">${escapeHtml(item.label)}</p>
              <p style="margin:0;color:#111;font-size:14px;line-height:1.6;">${nl2br(item.answer)}</p>
            </div>`,
        )
        .join('')
      return `<h2 style="margin:32px 0 14px;padding-bottom:6px;border-bottom:1px solid #e5e5e5;color:#111;font-size:16px;">${escapeHtml(section.title)}</h2>${items}`
    })
    .join('')

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f6f6;padding:24px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:32px 36px;">
      <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;">AXIOM Potential &amp; Commitment Assessment</p>
      <h1 style="margin:10px 0 20px;color:#111;font-size:22px;">${escapeHtml(applicant.fullName)}</h1>
      <table style="border-collapse:collapse;">${meta}</table>
      ${body}
    </div>
  </body>
</html>`
}

function renderText(applicant, sections, submittedAt) {
  const lines = [
    'AXIOM POTENTIAL & COMMITMENT ASSESSMENT',
    '='.repeat(48),
    `Name: ${applicant.fullName}`,
    applicant.preferredName ? `Preferred name: ${applicant.preferredName}` : null,
    `Email: ${applicant.email}`,
    applicant.phone ? `Phone: ${applicant.phone}` : null,
    applicant.location ? `Location: ${applicant.location}` : null,
    applicant.resumeLink ? `Resume link: ${applicant.resumeLink}` : null,
    applicant.linkedIn ? `LinkedIn: ${applicant.linkedIn}` : null,
    applicant.portfolio ? `Portfolio: ${applicant.portfolio}` : null,
    applicant.socialProfiles ? `Social profiles: ${applicant.socialProfiles}` : null,
    `Submitted: ${submittedAt}`,
    '',
  ].filter(Boolean)

  for (const section of sections) {
    lines.push('', section.title.toUpperCase(), '-'.repeat(48))
    for (const item of section.items) {
      lines.push('', `Q: ${item.label}`, `A: ${item.answer}`)
    }
  }

  return lines.join('\n')
}

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

  const body = req.body

  // Honeypot: bots fill the hidden "website" field. Pretend success.
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
  const submittedAt = new Date().toUTCString()
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
    const emailBody = {
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: applicant.email,
      subject: `AXIOM Application | ${applicant.fullName}`,
      html: renderHtml(applicant, body.sections, submittedAt),
      text: renderText(applicant, body.sections, submittedAt),
    }
    if (attachment) {
      emailBody.attachments = [attachment]
    }

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
      console.error(`Resend delivery failed (${upstream.status}): ${detail}`)
      res.status(502).json({
        detail: 'The application could not be delivered. Please try again in a moment.',
      })
      return
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error(`Careers email send failed: ${err?.message ?? err}`)
    res.status(502).json({
      detail: 'The application could not be delivered. Please try again in a moment.',
    })
  }
}
