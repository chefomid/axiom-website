const USER_AGENT = 'AXIOM-SeismicReport/1.0 (report-pdf)'

const PDF_TIMEOUT_MS = 45_000

export function reportApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) return `/api/reports${normalized}`
  const base = import.meta.env.VITE_REPORT_API_URL
  if (base) return `${base.replace(/\/$/, '')}${normalized}`
  return `/api/reports${normalized}`
}

function networkErrorMessage(err) {
  if (err?.name === 'AbortError') {
    return 'PDF generation timed out. The report service may be busy, try again.'
  }
  const msg = String(err?.message ?? err ?? '')
  if (
    msg === 'Failed to fetch' ||
    msg.includes('NetworkError') ||
    msg.includes('ECONNREFUSED') ||
    err?.name === 'TypeError'
  ) {
    if (import.meta.env.DEV) {
      return 'PDF service is not reachable. Run npm run dev:all from the project root and try again.'
    }
    return 'PDF service is temporarily unavailable. Please try again in a moment.'
  }
  return msg || 'Report PDF service unavailable.'
}

async function parseErrorResponse(res) {
  const text = await res.text().catch(() => '')
  if (!text) {
    if (res.status >= 500) {
      return import.meta.env.DEV
        ? 'Report PDF service unavailable. Run npm run dev:all and try again.'
        : 'Report PDF service unavailable. Please try again shortly.'
    }
    return res.statusText || 'Report PDF service unavailable.'
  }
  try {
    const data = JSON.parse(text)
    const detail = data.detail ?? data.message ?? res.statusText
    if (Array.isArray(detail)) {
      return detail.map(d => d.msg ?? JSON.stringify(d)).join('; ')
    }
    if (typeof detail === 'string') return detail
    return JSON.stringify(detail)
  } catch {
    if (res.status >= 500) {
      return import.meta.env.DEV
        ? 'Report PDF service unavailable. Run npm run dev:all and try again.'
        : 'Report PDF service unavailable. Please try again shortly.'
    }
    return text
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = PDF_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    throw new Error(networkErrorMessage(err))
  } finally {
    clearTimeout(timer)
  }
}

export async function createReportSession(document) {
  const res = await fetchWithTimeout(reportApiUrl('/sessions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ document }),
  })

  if (!res.ok) {
    const message = await parseErrorResponse(res)
    throw new Error(message || 'Report PDF service unavailable.')
  }

  return res.json()
}

export async function fetchReportSession(sessionId) {
  const res = await fetch(reportApiUrl(`/sessions/${encodeURIComponent(sessionId)}`), {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  })

  if (!res.ok) {
    const message = await parseErrorResponse(res)
    throw new Error(message || 'Report session not found.')
  }

  const data = await res.json()
  return data.document ?? data
}

function slugifyLocation(label) {
  return String(label ?? 'location')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function savePdfBlob(blob, locationLabel, prefix = 'seismic-report') {
  const slug = slugifyLocation(locationLabel) || 'location'
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${prefix}-${slug}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** One-shot: send ReportDocument, receive PDF bytes. */
export async function downloadReportPdf(reportDocument, locationLabel, { prefix = 'seismic-report' } = {}) {
  const res = await fetchWithTimeout(
    reportApiUrl('/pdf'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ document: reportDocument }),
    },
    PDF_TIMEOUT_MS,
  )

  if (!res.ok) {
    const message = await parseErrorResponse(res)
    throw new Error(message || 'Report PDF service unavailable.')
  }

  const blob = await res.blob()
  if (!blob.size) {
    throw new Error('PDF service returned an empty file.')
  }
  savePdfBlob(blob, locationLabel, prefix)
}

export async function checkReportApiHealth() {
  try {
    const res = await fetchWithTimeout(
      reportApiUrl('/health'),
      { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } },
      8_000,
    )
    if (!res.ok) return { ok: false, detail: 'Health check failed.' }
    const data = await res.json()
    return { ok: Boolean(data.ok), detail: data.detail ?? null }
  } catch (err) {
    return { ok: false, detail: networkErrorMessage(err) }
  }
}
