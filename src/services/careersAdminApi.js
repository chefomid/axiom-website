const TOKEN_KEY = 'careers-admin-token'

export const SUBMISSION_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'archived', label: 'Archived' },
]

function getToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseJson(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.detail ?? 'Request failed.'
    const error = new Error(detail)
    error.status = response.status
    throw error
  }
  return data
}

export function saveAdminToken(token) {
  window.sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearAdminToken() {
  window.sessionStorage.removeItem(TOKEN_KEY)
}

export function hasAdminToken() {
  return Boolean(getToken())
}

export async function loginAdmin(username, password) {
  const response = await fetch('/api/careers/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await parseJson(response)
  if (data.token) saveAdminToken(data.token)
  return data
}

export async function fetchSubmissions({ status = '', q = '' } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  const query = params.toString()
  const response = await fetch(`/api/careers/admin/submissions${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  })
  return parseJson(response)
}

export async function fetchSubmission(referenceId) {
  const response = await fetch(
    `/api/careers/admin/submission?referenceId=${encodeURIComponent(referenceId)}`,
    { headers: authHeaders() },
  )
  return parseJson(response)
}

export async function updateSubmission(referenceId, patch) {
  const response = await fetch(
    `/api/careers/admin/submission?referenceId=${encodeURIComponent(referenceId)}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  )
  return parseJson(response)
}

export async function downloadCsv({ status = '', q = '' } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  const query = params.toString()
  const response = await fetch(`/api/careers/admin/export${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  })
  if (!response.ok) {
    return parseJson(response)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'careers-submissions.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function resumeDownloadUrl(referenceId) {
  return `/api/careers/admin/resume?referenceId=${encodeURIComponent(referenceId)}`
}

export function getResumeAuthHeaders() {
  return authHeaders()
}
