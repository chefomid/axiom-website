const TRANSIENT_STATUS = new Set([429, 502, 503, 504])
export const FEED_RETRY_DELAY_MS = 60_000

const FEED_LABELS = {
  'NASA FIRMS': 'Wildfire data',
  USGS: 'Earthquake data',
  NWS: 'Weather alerts',
  'FEMA NFHL': 'Flood zone data',
}

export function parseFeedHttpStatus(message) {
  const match = String(message ?? '').match(/\((\d{3})\)/)
  return match ? Number(match[1]) : null
}

export function isTransientFeedError(message) {
  const status = parseFeedHttpStatus(message)
  return status != null && TRANSIENT_STATUS.has(status)
}

export function getFeedLabel(source) {
  return FEED_LABELS[source] ?? source
}

export function formatFeedError(source, message, retryAt) {
  const label = getFeedLabel(source)
  const transient = isTransientFeedError(message)

  if (transient) {
    return {
      title: `${label} temporarily unavailable`,
      detail:
        'The service is busy — too many requests in a short time. Please wait; we will refresh automatically.',
      retryAt: retryAt ?? null,
      transient: true,
    }
  }

  return {
    title: `${label} could not load`,
    detail: 'Something went wrong while fetching live data. We will try again on the next refresh.',
    retryAt: retryAt ?? null,
    transient: false,
  }
}

export function formatRetryCountdown(retryAt, now = Date.now()) {
  const remainingMs = Math.max(0, retryAt - now)
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
