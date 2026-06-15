const DEFAULT_MESSAGE =
  "You've hit a temporary usage limit. Please wait about a minute and try again."

const DEFAULT_SAFETY_NOTE =
  'We apply fair limits to keep the site reliable and safe for everyone.'

const buckets = new Map()

function pruneTimestamps(timestamps, windowMs, now) {
  const cutoff = now - windowMs
  while (timestamps.length && timestamps[0] <= cutoff) {
    timestamps.shift()
  }
  return timestamps
}

/**
 * @param {import('http').IncomingMessage} req
 */
export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'] ?? req.headers?.['X-Forwarded-For']
  if (forwarded) {
    const first = String(forwarded).split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers?.['x-real-ip'] ?? req.headers?.['X-Real-Ip']
  if (realIp) return String(realIp).trim()
  return req.socket?.remoteAddress ?? '127.0.0.1'
}

export function rateLimitDetail(retryAfterSeconds = 60) {
  return {
    code: 'rate_limit',
    message: DEFAULT_MESSAGE,
    safety_note: DEFAULT_SAFETY_NOTE,
    retry_after_seconds: retryAfterSeconds,
  }
}

/**
 * Sliding-window rate limit keyed by route + IP.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{ route: string, limit: number, windowMs: number }} options
 * @returns {boolean} true when allowed, false when limited (response already sent)
 */
export function checkRateLimit(req, res, { route, limit, windowMs }) {
  const ip = getClientIp(req)
  const key = `${route}:${ip}`
  const now = Date.now()
  const entry = buckets.get(key) ?? { timestamps: [] }
  entry.timestamps = pruneTimestamps(entry.timestamps, windowMs, now)

  if (entry.timestamps.length >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.timestamps[0] + windowMs - now) / 1000),
    )
    res.status(429)
    res.setHeader('Retry-After', String(retryAfterSeconds))
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        detail: rateLimitDetail(retryAfterSeconds),
      }),
    )
    return false
  }

  entry.timestamps.push(now)
  buckets.set(key, entry)
  return true
}

/** Reset buckets (for tests). */
export function resetRateLimitsForTests() {
  buckets.clear()
}
