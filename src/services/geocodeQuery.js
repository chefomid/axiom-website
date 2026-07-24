/** Soft ceiling so autocomplete cannot hang on a stalled Census/Photon proxy. */
export const GEOCODE_FETCH_TIMEOUT_MS = 5000

/**
 * Merge an optional caller AbortSignal with a timeout.
 * @param {AbortSignal | undefined} signal
 * @param {number} [timeoutMs]
 * @returns {{ signal: AbortSignal, cleanup: () => void }}
 */
export function withGeocodeTimeout(signal, timeoutMs = GEOCODE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

/** House number alone (e.g. "825") returns junk worldwide, require a street name. */
export function isSearchableAddressQuery(query, minLength = 4) {
  const q = query.trim()
  if (q.length < minLength) return false
  if (/[a-zA-Z]{2,}/.test(q)) return true
  if (/^\d+\s+[a-zA-Z]/.test(q)) return true
  return false
}

/** Property workflow, wait for a fuller address before suggesting or resolving. */
export function isPropertyAddressQuery(query) {
  const q = query.trim()
  if (!isSearchableAddressQuery(q, 5)) return false
  if (q.includes(',')) return true
  return /^\d+\s+[a-zA-Z]+\s+[a-zA-Z]{2,}/.test(q)
}
