const memory = new Map()

const TTL_MS = {
  usgs: 5 * 60 * 1000,
  'usgs-history': 60 * 60 * 1000,
  nws: 3 * 60 * 1000,
  firms: 15 * 60 * 1000,
  nfhl: 7 * 24 * 60 * 60 * 1000,
}

const SESSION_FEEDS = new Set(['usgs', 'usgs-history'])

function storageKey(feed, key) {
  return `axiom-risk-cache:${feed}:${key}`
}

/**
 * @param {'usgs'|'usgs-history'|'nws'|'firms'|'nfhl'} feed
 * @param {string} key
 */
export function getRiskCache(feed, key) {
  const mem = memory.get(`${feed}:${key}`)
  if (mem && Date.now() < mem.expiresAt) return mem.data

  if (SESSION_FEEDS.has(feed)) {
    try {
      const raw = sessionStorage.getItem(storageKey(feed, key))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (Date.now() >= parsed.expiresAt) {
        sessionStorage.removeItem(storageKey(feed, key))
        return null
      }
      memory.set(`${feed}:${key}`, parsed)
      return parsed.data
    } catch {
      return null
    }
  }

  return null
}

/**
 * @param {'usgs'|'usgs-history'|'nws'|'firms'|'nfhl'} feed
 * @param {string} key
 * @param {unknown} data
 */
export function setRiskCache(feed, key, data) {
  const entry = { data, expiresAt: Date.now() + (TTL_MS[feed] ?? 5 * 60 * 1000) }
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
