/** Branded careers application emails (applicant confirmation + internal notification). */

const NOT_ANSWERED = '(not answered)'
const DEFAULT_SITE_URL = 'https://www.axiompropertycasualty.com'

export function getCareersSiteUrl() {
  return (process.env.CAREERS_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '')
}

export function generateReferenceId(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 8)
  return `AXM-${year}${month}${day}-${suffix}`
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>')
}

function formatSubmittedDate(submittedAt) {
  try {
    return new Date(submittedAt).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
      timeZoneName: 'short',
    })
  } catch {
    return String(submittedAt)
  }
}

function isEmptyAnswer(answer) {
  const text = String(answer ?? '').trim()
  return !text || text === NOT_ANSWERED
}

function shouldOmitApplicantRow(label, answer) {
  if (!isEmptyAnswer(answer)) return false
  const optionalLabels = [
    'resume upload',
    'resume link',
    'linkedin',
    'portfolio',
    'social profiles',
    'website',
  ]
  return optionalLabels.some(key => String(label).toLowerCase().includes(key))
}

function renderSummaryRows(applicant, { includeEmpty }) {
  const rows = [
    ['Name', applicant.fullName],
    ['Preferred name', applicant.preferredName],
    ['Email', applicant.email],
    ['Phone', applicant.phone],
    ['Location', applicant.location],
    ['Resume link', applicant.resumeLink],
    ['LinkedIn', applicant.linkedIn],
    ['Portfolio', applicant.portfolio],
    ['Social profiles', applicant.socialProfiles],
  ]

  return rows
    .filter(([, value]) => includeEmpty || Boolean(String(value ?? '').trim()))
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 16px 6px 0;color:#666666;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;white-space:nowrap;vertical-align:top;width:140px;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#111111;font-size:14px;line-height:1.5;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('')
}

export function renderSectionsHtml(sections, { includeEmpty = true } = {}) {
  return sections
    .map(section => {
      const items = section.items
        .filter(item => includeEmpty || !shouldOmitApplicantRow(item.label, item.answer))
        .filter(item => includeEmpty || !isEmptyAnswer(item.answer))
        .map(item => {
          const answer = item.answer
          const displayAnswer =
            !includeEmpty && String(item.label).toLowerCase().includes('resume upload') && answer.startsWith('Attached:')
              ? 'Resume attached to our internal record.'
              : answer
          return `<div style="margin:0 0 16px;">
            <p style="margin:0 0 6px;color:#555555;font-size:13px;font-weight:600;line-height:1.4;">${escapeHtml(item.label)}</p>
            <p style="margin:0;color:#111111;font-size:14px;line-height:1.65;">${nl2br(displayAnswer)}</p>
          </div>`
        })
        .join('')

      if (!items) return ''

      return `<div style="margin:28px 0 0;">
        <p style="margin:0 0 10px;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;">${escapeHtml(section.title)}</p>
        <div style="border-top:1px solid #e5e5e5;padding-top:14px;">${items}</div>
      </div>`
    })
    .filter(Boolean)
    .join('')
}

export function renderSectionsText(sections, { includeEmpty = true } = {}) {
  const lines = []
  for (const section of sections) {
    const items = section.items.filter(
      item => includeEmpty || (!shouldOmitApplicantRow(item.label, item.answer) && !isEmptyAnswer(item.answer)),
    )
    if (!items.length) continue
    lines.push('', section.title.toUpperCase(), '-'.repeat(48))
    for (const item of items) {
      const displayAnswer =
        !includeEmpty && String(item.label).toLowerCase().includes('resume upload') && item.answer.startsWith('Attached:')
          ? 'Resume attached to our internal record.'
          : item.answer
      lines.push('', item.label, displayAnswer)
    }
  }
  return lines.join('\n')
}

function renderEmailShell({ eyebrow, title, bodyHtml, siteUrl }) {
  const logoUrl = `${siteUrl}/brand/axiom-email-mark.png`
  const siteHost = siteUrl.replace(/^https?:\/\//, '')

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(eyebrow)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">
            <tr>
              <td style="background:#080808;border-radius:12px 12px 0 0;padding:20px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${escapeHtml(logoUrl)}" alt="AXIOM" width="120" height="32" style="display:block;border:0;max-width:120px;height:auto;" />
                      <p style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:600;letter-spacing:0.2em;color:#ffffff;">AXIOM</p>
                    </td>
                    <td align="right" style="vertical-align:middle;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;">Talent discovery</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;padding:32px 28px;">
                <p style="margin:0 0 8px;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0 0 20px;color:#111111;font-size:22px;font-weight:600;line-height:1.3;">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background:#111111;border-radius:0 0 12px 12px;padding:20px 28px;color:#999999;font-size:11px;line-height:1.6;">
                <p style="margin:0 0 8px;color:#cccccc;font-size:13px;">, The AXIOM Team</p>
                <p style="margin:0 0 4px;">AXIOM, Property &amp; Casualty Intelligence</p>
                <p style="margin:0;"><a href="${escapeHtml(siteUrl)}" style="color:#22c55e;text-decoration:none;">${escapeHtml(siteHost)}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function renderSignatureText(siteUrl) {
  const siteHost = siteUrl.replace(/^https?:\/\//, '')
  return [', The AXIOM Team', 'AXIOM, Property & Casualty Intelligence', siteHost].join('\n')
}

export function renderApplicantConfirmation({
  applicant,
  sections,
  submittedAt,
  referenceId,
  siteUrl = getCareersSiteUrl(),
}) {
  const greetingName = applicant.preferredName || applicant.fullName
  const formattedDate = formatSubmittedDate(submittedAt)

  const bodyHtml = `
    <p style="margin:0 0 12px;color:#111111;font-size:15px;line-height:1.6;">Thank you, ${escapeHtml(greetingName)}.</p>
    <p style="margin:0 0 20px;color:#444444;font-size:14px;line-height:1.6;">We received your application on ${escapeHtml(formattedDate)}.</p>
    <p style="margin:0 0 24px;padding:10px 14px;background:#f6f6f6;border-radius:8px;color:#333333;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">Reference: ${escapeHtml(referenceId)}</p>
    <div style="margin:0 0 8px;padding:16px 18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
      <p style="margin:0 0 10px;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;">Submission summary</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">${renderSummaryRows(applicant, { includeEmpty: false })}</table>
    </div>
    ${renderSectionsHtml(sections, { includeEmpty: false })}
    <div style="margin:32px 0 0;padding-top:20px;border-top:1px solid #e5e5e5;">
      <p style="margin:0 0 10px;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;">What happens next</p>
      <ul style="margin:0;padding:0 0 0 18px;color:#444444;font-size:14px;line-height:1.7;">
        <li style="margin-bottom:6px;">We review every submission carefully.</li>
        <li style="margin-bottom:6px;">If your profile aligns with what we are building, we will reach you at the contact details you provided.</li>
        <li>No further action is needed from you right now.</li>
      </ul>
    </div>
    <p style="margin:24px 0 0;color:#888888;font-size:11px;line-height:1.6;">This message was sent because you submitted an application on our site. Keep this email for your records.</p>`

  const text = [
    'Application received, AXIOM Careers',
    '',
    `Thank you, ${greetingName}.`,
    `We received your application on ${formattedDate}.`,
    `Reference: ${referenceId}`,
    '',
    'SUBMISSION SUMMARY',
    `Name: ${applicant.fullName}`,
    applicant.preferredName ? `Preferred name: ${applicant.preferredName}` : null,
    `Email: ${applicant.email}`,
    applicant.phone ? `Phone: ${applicant.phone}` : null,
    applicant.location ? `Location: ${applicant.location}` : null,
    renderSectionsText(sections, { includeEmpty: false }),
    '',
    'WHAT HAPPENS NEXT',
    '• We review every submission carefully.',
    '• If your profile aligns with what we are building, we will reach you at the contact details you provided.',
    '• No further action is needed from you right now.',
    '',
    renderSignatureText(siteUrl),
    '',
    'Keep this email for your records.',
  ]
    .filter(line => line !== null)
    .join('\n')

  return {
    subject: 'Application received, AXIOM Careers',
    html: renderEmailShell({
      eyebrow: 'Application confirmation',
      title: 'Your submission is on file.',
      bodyHtml,
      siteUrl,
    }),
    text,
  }
}

export function renderInternalNotification({
  applicant,
  sections,
  submittedAt,
  referenceId,
  siteUrl = getCareersSiteUrl(),
}) {
  const formattedDate = formatSubmittedDate(submittedAt)
  const adminUrl = `${siteUrl}/careers/admin`

  const bodyHtml = `
    <p style="margin:0 0 12px;color:#111111;font-size:15px;line-height:1.6;">New application from ${escapeHtml(applicant.fullName)}.</p>
    <p style="margin:0 0 20px;color:#444444;font-size:14px;line-height:1.6;">Submitted ${escapeHtml(formattedDate)} · Reference ${escapeHtml(referenceId)}</p>
    <div style="margin:0 0 24px;padding:16px 18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">${renderSummaryRows(applicant, { includeEmpty: true })}</table>
    </div>
    ${renderSectionsHtml(sections, { includeEmpty: true })}
    <p style="margin:28px 0 0;color:#666666;font-size:13px;line-height:1.6;">Reply directly to this thread to reach the applicant. Review submissions in the <a href="${escapeHtml(adminUrl)}" style="color:#111111;">careers admin console</a>.</p>`

  const text = [
    `New application | ${applicant.fullName} | ${referenceId}`,
    '',
    `Submitted: ${formattedDate}`,
    `Reference: ${referenceId}`,
    '',
    `Name: ${applicant.fullName}`,
    applicant.preferredName ? `Preferred name: ${applicant.preferredName}` : null,
    `Email: ${applicant.email}`,
    applicant.phone ? `Phone: ${applicant.phone}` : null,
    applicant.location ? `Location: ${applicant.location}` : null,
    applicant.resumeLink ? `Resume link: ${applicant.resumeLink}` : null,
    applicant.linkedIn ? `LinkedIn: ${applicant.linkedIn}` : null,
    applicant.portfolio ? `Portfolio: ${applicant.portfolio}` : null,
    applicant.socialProfiles ? `Social profiles: ${applicant.socialProfiles}` : null,
    renderSectionsText(sections, { includeEmpty: true }),
    '',
    'Reply directly to this thread to reach the applicant.',
    renderSignatureText(siteUrl),
  ]
    .filter(line => line !== null)
    .join('\n')

  return {
    subject: `New application | ${applicant.fullName} | ${referenceId}`,
    html: renderEmailShell({
      eyebrow: 'Internal record, AXIOM Careers application',
      title: applicant.fullName,
      bodyHtml,
      siteUrl,
    }),
    text,
  }
}
