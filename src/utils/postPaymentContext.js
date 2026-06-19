const STORAGE_KEY = 'axiom:post-payment-context'
const TTL_MS = 30 * 60 * 1000

export function savePostPaymentContext(payload) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }))
  } catch {
    // ignore storage failures
  }
}

export function loadPostPaymentContext() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - (data.savedAt ?? 0) > TTL_MS) {
      clearPostPaymentContext()
      return null
    }
    return data
  } catch {
    return null
  }
}

export function clearPostPaymentContext() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function isReportPostPaymentPurpose(purpose) {
  return purpose === 'enrich' || purpose === 'batch_enrich'
}
