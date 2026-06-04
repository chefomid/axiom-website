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

export function formatFeedAge(date) {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatFeedError(source, message, options = {}) {
  const { retryAt = null, stale = false, lastFetchedAt = null } = options
  const label = getFeedLabel(source)
  const transient = isTransientFeedError(message)
  const age = formatFeedAge(lastFetchedAt)

  if (stale) {
    return {
      title: `${label} couldn't update`,
      detail: age
        ? `Showing data from ${age}. Your other hazard layers are unaffected.`
        : 'Showing your last loaded data. Your other hazard layers are unaffected.',
      retryAt,
      transient: true,
      severity: 'watch',
    }
  }

  if (transient) {
    return {
      title: `${label} is busy right now`,
      detail: 'The official feed is responding slowly. Retrying automatically.',
      retryAt,
      transient: true,
      severity: 'watch',
    }
  }

  return {
    title: `${label} isn't available`,
    detail: "We couldn't reach the official feed. Other hazard layers are still active.",
    retryAt,
    transient: false,
    severity: 'critical',
  }
}

export function formatRetryCountdown(retryAt, now = Date.now()) {
  const remainingMs = Math.max(0, retryAt - now)
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
