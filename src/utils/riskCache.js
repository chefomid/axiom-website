const memory = new Map()

const TTL_MS = {
  usgs: 5 * 60 * 1000,
  'usgs-history': 60 * 60 * 1000,
  nws: 3 * 60 * 1000,
  firms: 15 * 60 * 1000,
  nfhl: 7 * 24 * 60 * 60 * 1000,
}

const SESSION_FEEDS = new Set(['usgs', 'usgs-history', 'nws', 'nfhl', 'firms'])

function storageKey(feed, key) {
  return `axiom-risk-cache:${feed}:${key}`
}

function readCacheEntry(feed, key, { allowExpired = false } = {}) {
  const memKey = `${feed}:${key}`
  const mem = memory.get(memKey)
  if (mem && (allowExpired || Date.now() < mem.expiresAt)) {
    return mem
  }

  if (SESSION_FEEDS.has(feed)) {
    try {
      const raw = sessionStorage.getItem(storageKey(feed, key))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!allowExpired && Date.now() >= parsed.expiresAt) {
        sessionStorage.removeItem(storageKey(feed, key))
        return null
      }
      memory.set(memKey, parsed)
      return parsed
    } catch {
      return null
    }
  }

  return null
}

/**
 * @param {'usgs'|'usgs-history'|'nws'|'firms'|'nfhl'} feed
 * @param {string} key
 */
export function getRiskCache(feed, key) {
  const entry = readCacheEntry(feed, key, { allowExpired: false })
  return entry?.data ?? null
}

/**
 * Returns last cached payload even when TTL expired (for stale-while-revalidate).
 * @param {'usgs'|'usgs-history'|'nws'|'firms'|'nfhl'} feed
 * @param {string} key
 */
export function getStaleRiskCache(feed, key) {
  const entry = readCacheEntry(feed, key, { allowExpired: true })
  if (!entry?.data) return null
  const fetchedAt =
    entry.fetchedAt ?? entry.expiresAt - (TTL_MS[feed] ?? 5 * 60 * 1000)
  return { data: entry.data, fetchedAt, expiresAt: entry.expiresAt }
}

/**
 * @param {'usgs'|'usgs-history'|'nws'|'firms'|'nfhl'} feed
 * @param {string} key
 * @param {unknown} data
 */
export function setRiskCache(feed, key, data) {
  const now = Date.now()
  const entry = {
    data,
    fetchedAt: now,
    expiresAt: now + (TTL_MS[feed] ?? 5 * 60 * 1000),
  }
  memory.set(`${feed}:${key}`, entry)

  if (SESSION_FEEDS.has(feed)) {
    try {
      sessionStorage.setItem(storageKey(feed, key), JSON.stringify(entry))
    } catch {
      // quota exceeded — memory cache only
    }
  }
}

export function riskCacheKey(parts) {
  return parts.filter(Boolean).join('|')
}
