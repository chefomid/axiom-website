const USER_AGENT = 'AXIOM-PropertyIntelligence/0.1 (property-intelligence)'

export function propertyApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) return `/api/property${normalized}`
  const base = import.meta.env.VITE_PROPERTY_API_URL
  if (base) return `${base.replace(/\/$/, '')}${normalized}`
  return `/api/property${normalized}`
}

export async function enrichProperty({ address, sourceUrl }) {
  const body = { address: address.trim() }
  if (sourceUrl?.trim()) body.source_url = sourceUrl.trim()

  const res = await fetch(propertyApiUrl('/enrich'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data.detail ?? data.message ?? res.statusText
    const message = Array.isArray(detail)
      ? detail.map(d => d.msg ?? JSON.stringify(d)).join('; ')
      : typeof detail === 'string'
        ? detail
        : JSON.stringify(detail)
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return data
}

export async function checkPropertyApiHealth() {
  const res = await fetch(propertyApiUrl('/health'), {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  })
  return res.ok
}
