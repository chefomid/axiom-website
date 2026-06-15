const STORAGE_KEY = 'axiom:billing-resume'
const TTL_MS = 30 * 60 * 1000

export function saveBillingResume(payload) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }))
  } catch {
    // ignore storage failures
  }
}

export function loadBillingResume() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - (data.savedAt ?? 0) > TTL_MS) {
      clearBillingResume()
      return null
    }
    return data
  } catch {
    return null
  }
}

export function clearBillingResume() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
