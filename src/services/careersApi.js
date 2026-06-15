import { APPLICATION_ROLE, APPLICATION_STEPS } from '../components/careers/applicationSchema'
import { isCareersOrganizeLlmEnabled } from '../config/features'
import { attachApiErrorMetadata, messageFromApiError, parseApiDetail } from '../utils/apiErrors'
import { lightOrganizeText, shouldUseLlmOrganize } from '../utils/careersOrganize'



const NOT_ANSWERED = '(not answered)'



const LIKERT_LABELS = {

  1: 'Strongly Disagree',

  2: 'Disagree',

  3: 'Neutral',

  4: 'Agree',

  5: 'Strongly Agree',

}



function formatGroupedAnswers(field, value, formatEntry) {

  const answers = value ?? {}

  return field.items.map(item => formatEntry(item, answers[item.id])).join('\n')

}



function answerFor(field, values) {

  const value = values[field.id]



  switch (field.type) {

    case 'multiselect':

    case 'select': {

      if (field.type === 'select' && !field.multiple) {

        const text = value == null ? '' : String(value).trim()

        const other = values[`${field.id}__other`]

        if (text === 'Other' && other && String(other).trim()) {

          return `Other: ${String(other).trim()}`

        }

        if (text) return text

        return NOT_ANSWERED

      }

      const picked = Array.isArray(value) ? [...value] : []

      const other = values[`${field.id}__other`]

      if (other && String(other).trim()) picked.push(`Other: ${String(other).trim()}`)

      return picked.length > 0 ? picked.join('; ') : NOT_ANSWERED

    }

    case 'ratingGroup': {

      const max = field.max ?? 5

      const prefix = field.itemPrefix ? `${field.itemPrefix} ` : ''

      return formatGroupedAnswers(field, value, (item, score) =>

        `${prefix}${item.label}: ${score ? `${score}/${max}` : NOT_ANSWERED}`,

      )

    }

    case 'likertGroup':

      return formatGroupedAnswers(field, value, (item, score) =>

        `${item.label}: ${score ? LIKERT_LABELS[score] ?? score : NOT_ANSWERED}`,

      )

    case 'yesNoGroup':

      return formatGroupedAnswers(field, value, (item, answer) =>

        `${item.label}: ${answer ?? NOT_ANSWERED}`,

      )

    case 'sentenceGroup':

      return formatGroupedAnswers(field, value, (item, answer) =>

        `${item.prefix} ${answer?.trim() ? answer.trim() : NOT_ANSWERED}`,

      )

    case 'checkboxGroup': {

      const checks = value ?? {}

      return field.items

        .map(item => `[${checks[item.id] ? 'x' : ' '}] ${item.label}`)

        .join('\n')

    }

    case 'file': {

      if (value?.error) return value.error

      if (value?.name) return `Attached: ${value.name}`

      return NOT_ANSWERED

    }

    default: {

      const text = value == null ? '' : String(value).trim()

      return text || NOT_ANSWERED

    }

  }

}



function applicantFullName(values) {

  const first = String(values.firstName ?? '').trim()

  const last = String(values.lastName ?? '').trim()

  return [first, last].filter(Boolean).join(' ')

}



function extractAttachment(values) {

  const file = values.resumeFile

  if (!file?.dataUrl || file.error) return null



  const base64 = String(file.dataUrl).split(',')[1]

  if (!base64) return null



  return {

    filename: file.name || 'resume',

    content: base64,

  }

}



/** Shape the flat form values into labeled sections for the email. */

export function buildSubmissionPayload(values, { honeypot = '' } = {}) {

  const sections = [
    {
      title: 'Position',
      items: [{ label: 'Role', answer: APPLICATION_ROLE }],
    },
    ...APPLICATION_STEPS.map(step => ({
      title: step.title,
      items: step.fields.map(field => ({
        label: field.label,
        answer: answerFor(field, values),
      })),
    })),
  ]



  const attachment = extractAttachment(values)



  return {

    applicant: {

      fullName: applicantFullName(values),

      roleApplied: APPLICATION_ROLE,

      preferredName: String(values.preferredName ?? '').trim(),

      email: String(values.email ?? '').trim(),

      phone: String(values.phone ?? '').trim(),

      location: String(values.location ?? '').trim(),

      resumeLink: String(values.resumeLink ?? '').trim(),

      linkedIn: String(values.linkedIn ?? '').trim(),

      portfolio: String(values.portfolio ?? '').trim(),

      socialProfiles: String(values.socialProfiles ?? '').trim(),

    },

    sections,

    attachment,

    website: honeypot,

  }

}



export async function submitApplication(values, { honeypot = '' } = {}) {

  const payload = buildSubmissionPayload(values, { honeypot })



  let response

  try {

    response = await fetch('/api/careers/apply', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(payload),

    })

  } catch {

    if (import.meta.env.DEV) return devFallback(payload)

    throw new Error('Network error while submitting. Check your connection and try again.')

  }



  if (!response.ok) {

    if (import.meta.env.DEV && (response.status === 404 || response.status === 405)) {

      return devFallback(payload)

    }

    let detail = 'Submission failed. Please try again in a moment.'

    try {

      const data = await response.json()

      if (data?.detail) detail = data.detail

    } catch {

      /* non-JSON error body */

    }

    const parsed = parseApiDetail(detail)
    const message =
      typeof parsed?.message === 'string'
        ? parsed.message
        : typeof detail === 'string'
          ? detail
          : 'Submission failed. Please try again in a moment.'
    const err = new Error(message)
    attachApiErrorMetadata(err, { status: response.status, detail })
    throw err

  }



  const data = await response.json()
  return {
    ok: Boolean(data?.ok),
    referenceId: typeof data?.referenceId === 'string' ? data.referenceId : null,
    dev: Boolean(data?.dev),
  }
}

let organizeModelInfoPromise = null

export async function fetchOrganizeModelInfo() {
  if (!organizeModelInfoPromise) {
    organizeModelInfoPromise = (async () => {
      try {
        const response = await fetch('/api/careers/organize/info')
        if (response.ok) {
          const data = await response.json()
          if (typeof data?.modelLabel === 'string' && data.modelLabel.trim()) {
            return data.modelLabel.trim()
          }
        }
      } catch {
        /* fallback below */
      }
      return 'Nemotron Mini'
    })()
  }
  return organizeModelInfoPromise
}

export async function organizeThoughts(text, { question = '' } = {}) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return { text: '' }

  const fallback = () => ({ text: lightOrganizeText(trimmed) })

  if (!isCareersOrganizeLlmEnabled() || !shouldUseLlmOrganize(trimmed)) {
    return fallback()
  }

  try {
    const response = await fetch('/api/careers/organize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, question }),
    })

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}))
      const err = new Error(messageFromApiError({ rateLimit: parseApiDetail(data.detail) }))
      attachApiErrorMetadata(err, { status: 429, detail: data.detail })
      throw err
    }

    if (response.ok) {
      const data = await response.json()
      const organized = typeof data?.text === 'string' ? data.text.trim() : ''
      if (organized) return { text: organized }
    }

    return fallback()
  } catch (err) {
    if (err?.status === 429) throw err
    throw new Error('organize_unreachable')
  }
}

function devFallback(payload) {
  console.info(
    '[careers] Dev mode: /api/careers/apply is not available. Submission payload below would be saved in production.',
  )
  console.info({
    ...payload,
    attachment: payload.attachment
      ? { filename: payload.attachment.filename, content: '[base64 omitted]' }
      : null,
  })
  return { ok: true, dev: true, referenceId: null }
}


