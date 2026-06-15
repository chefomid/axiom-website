const DEFAULT_ROLE = 'Project Manager'

function resolveRoleApplied(row) {
  if (row?.role_applied) return String(row.role_applied)
  try {
    const payload = typeof row?.payload === 'string' ? JSON.parse(row.payload) : row?.payload
    return payload?.applicant?.roleApplied ?? DEFAULT_ROLE
  } catch {
    return DEFAULT_ROLE
  }
}

export function serializeSubmission(row, { includePayload = false } = {}) {
  if (!row) return null

  const base = {
    id: row.id,
    referenceId: row.reference_id,
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : String(row.submitted_at ?? ''),
    status: row.status,
    adminNotes: row.admin_notes ?? '',
    roleApplied: resolveRoleApplied(row),
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    applicantPhone: row.applicant_phone ?? '',
    applicantLocation: row.applicant_location ?? '',
    hasResume: Boolean(row.has_resume),
  }

  if (includePayload) {
    base.payload =
      typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload ?? null
  }

  return base
}

export function parseQuery(url = '') {
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return new URLSearchParams()
  return new URLSearchParams(url.slice(queryIndex + 1))
}
