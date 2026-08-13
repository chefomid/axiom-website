const memory = new Map()
const lastGoodMemory = new Map()

const TTL_MS = {
  usgs: 5 * 60 * 1000,
  'usgs-history': 60 * 60 * 1000,
  nws: 3 * 60 * 1000,
  firms: 15 * 60 * 1000,
  nfhl: 7 * 24 * 60 * 60 * 1000,
}

const SESSION_FEEDS = new Set(['usgs', 'usgs-history', 'nws', 'nfhl', 'firms'])
const LAST_GOOD_FEEDS = new Set(['firms'])
const LAST_GOOD_FALLBACK_KEY = 'last-good'

function storageKey(feed, key) {
  return `axiom-risk-cache:${feed}:${key}`
}

function lastGoodStorageKey(feed, key) {
  return `axiom-risk-last-good:${feed}:${key}`
}

function payloadRecordCount(data) {
  if (Array.isArray(data?.events)) return data.events.length
  if (Array.isArray(data?.markers)) return data.markers.length
  return 0
}

function readLastGoodEntry(feed, key) {
  const memKey = `${feed}:${key}`
  const mem = lastGoodMemory.get(memKey)
  if (mem?.data) return mem

  try {
    const raw = localStorage.getItem(lastGoodStorageKey(feed, key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data) return null
    lastGoodMemory.set(memKey, parsed)
    return parsed
  } catch {
    return null
  }
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
  const data = entry?.data
  if (data && payloadRecordCount(data) > 0) return data
  if (LAST_GOOD_FEEDS.has(feed)) {
    const lastGood = getLastGoodRiskCache(feed, key)
    if (lastGood?.data) return lastGood.data
  }
  return data ?? null
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
      // quota exceeded, memory cache only
    }
  }

  rememberLastGoodRiskCache(feed, key, data)
}

/**
 * Persist a successful fire (or other last-good) payload until a later run has records.
 * Empty runs do not overwrite. Does not expire.
 */
export function rememberLastGoodRiskCache(feed, key, data) {
  if (!LAST_GOOD_FEEDS.has(feed)) return
  if (payloadRecordCount(data) <= 0) return

  const entry = { data, fetchedAt: Date.now() }
  lastGoodMemory.set(`${feed}:${key}`, entry)
  lastGoodMemory.set(`${feed}:${LAST_GOOD_FALLBACK_KEY}`, entry)

  try {
    const serialized = JSON.stringify(entry)
    localStorage.setItem(lastGoodStorageKey(feed, key), serialized)
    localStorage.setItem(lastGoodStorageKey(feed, LAST_GOOD_FALLBACK_KEY), serialized)
  } catch {
    // quota / SSR
  }
}

/**
 * Last successful payload for this feed, even if TTL cache was overwritten by an empty run.
 */
export function getLastGoodRiskCache(feed, key) {
  if (!LAST_GOOD_FEEDS.has(feed)) return null
  const scoped = readLastGoodEntry(feed, key)
  if (scoped?.data && payloadRecordCount(scoped.data) > 0) {
    return { data: scoped.data, fetchedAt: scoped.fetchedAt }
  }
  const fallback = readLastGoodEntry(feed, LAST_GOOD_FALLBACK_KEY)
  if (fallback?.data && payloadRecordCount(fallback.data) > 0) {
    return { data: fallback.data, fetchedAt: fallback.fetchedAt }
  }
  return null
}

export function riskCacheKey(parts) {
  return parts.filter(Boolean).join('|')
}
