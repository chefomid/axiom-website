const DEFAULT_RATE_LIMIT_MESSAGE =
  "You've hit a temporary usage limit. Please wait about a minute and try again."

const DEFAULT_SAFETY_NOTE =
  'We apply fair limits to keep the site reliable and safe for everyone.'

/** Normalize FastAPI / Vercel `detail` payloads. */
export function parseApiDetail(detail) {
  if (detail == null) return null
  if (typeof detail === 'string') return { message: detail }
  if (typeof detail === 'object' && !Array.isArray(detail)) return detail
  if (Array.isArray(detail)) {
    return {
      message: detail.map(item => item?.msg ?? JSON.stringify(item)).join('; '),
    }
  }
  return { message: String(detail) }
}

export function isRateLimitDetail(detail) {
  return detail?.code === 'rate_limit'
}

export function isRateLimitError(err) {
  return err?.status === 429 || isRateLimitDetail(err?.rateLimit) || isRateLimitDetail(err)
}

export function formatRateLimitMessage(detail) {
  const parsed = parseApiDetail(detail) ?? {}
  return {
    title: parsed.message ?? DEFAULT_RATE_LIMIT_MESSAGE,
    safetyNote: parsed.safety_note ?? DEFAULT_SAFETY_NOTE,
    retryAfterSeconds: parsed.retry_after_seconds ?? 60,
  }
}

/** Build a single display string with optional safety note on a second line. */
export function formatRateLimitDisplay(detail) {
  const { title, safetyNote } = formatRateLimitMessage(detail)
  return safetyNote ? `${title}\n${safetyNote}` : title
}

export function attachApiErrorMetadata(err, { status, detail }) {
  const parsed = parseApiDetail(detail)
  err.status = status
  if (isRateLimitDetail(parsed)) {
    err.rateLimit = parsed
  }
  if (status === 402 && parsed && typeof parsed === 'object') {
    err.paymentRequired = parsed
  }
  return err
}

export function messageFromApiError(err, fallback = 'Request failed.') {
  if (isRateLimitError(err)) {
    return formatRateLimitMessage(err.rateLimit ?? err).title
  }
  return err?.message ?? fallback
}

export function safetyNoteFromApiError(err) {
  if (!isRateLimitError(err)) return null
  return formatRateLimitMessage(err.rateLimit ?? err).safetyNote
}
