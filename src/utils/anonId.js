const STORAGE_KEY = 'axiom:property-intelligence:anon-id'

export function setAnonId(id) {
  const trimmed = String(id ?? '').trim()
  if (!trimmed) return false
  try {
    localStorage.setItem(STORAGE_KEY, trimmed)
    return true
  } catch {
    return false
  }
}

export function adoptAnonIdFromSearchParams(searchParams) {
  const id = searchParams?.get?.('anon_id')?.trim()
  if (!id) return false
  return setAnonId(id)
}

export function getOrCreateAnonId() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing?.trim()) return existing.trim()
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    return `anon-${Date.now()}`
  }
}
