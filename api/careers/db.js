import { neon } from '@neondatabase/serverless'
import { CAREERS_OPEN_ROLE } from './roles.js'

export const SUBMISSION_STATUSES = ['new', 'reviewing', 'contacted', 'archived']

let sqlClient = null

export function getCareersDatabaseUrl() {
  return (
    process.env.CAREERS_DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ''
  )
}

export function isCareersDbEnabled() {
  return Boolean(getCareersDatabaseUrl())
}

function getSql() {
  if (!isCareersDbEnabled()) return null
  if (!sqlClient) {
    sqlClient = neon(getCareersDatabaseUrl())
  }
  return sqlClient
}

export async function ensureCareersSchema() {
  const sql = getSql()
  if (!sql) return false

  await sql`
    CREATE TABLE IF NOT EXISTS careers_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference_id text NOT NULL UNIQUE,
      submitted_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'new',
      admin_notes text,
      applicant_name text NOT NULL,
      applicant_email text NOT NULL,
      applicant_phone text,
      applicant_location text,
      payload jsonb NOT NULL,
      resume_filename text,
      resume_content bytea
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS careers_submissions_submitted_at_idx ON careers_submissions (submitted_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS careers_submissions_status_idx ON careers_submissions (status)`
  await sql`CREATE INDEX IF NOT EXISTS careers_submissions_applicant_email_idx ON careers_submissions (applicant_email)`
  return true
}
export async function insertSubmission({
  referenceId,
  submittedAt,
  applicant,
  sections,
  attachment,
}) {
  const sql = getSql()
  if (!sql) return null

  const payload = { applicant, sections }
  let resumeBuffer = null
  let resumeFilename = null

  if (attachment?.content && attachment?.filename) {
    resumeFilename = attachment.filename
    resumeBuffer = Buffer.from(attachment.content, 'base64')
  }

  const rows = await sql`
    INSERT INTO careers_submissions (
      reference_id,
      submitted_at,
      status,
      applicant_name,
      applicant_email,
      applicant_phone,
      applicant_location,
      payload,
      resume_filename,
      resume_content
    ) VALUES (
      ${referenceId},
      ${submittedAt},
      'new',
      ${applicant.fullName},
      ${applicant.email},
      ${applicant.phone || null},
      ${applicant.location || null},
      ${payload},
      ${resumeFilename},
      ${resumeBuffer}
    )
    RETURNING id, reference_id, submitted_at, status
  `

  return rows[0] ?? null
}

export async function listSubmissions({ status, q, limit = 100 } = {}) {
  const sql = getSql()
  if (!sql) return []

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const search = String(q ?? '').trim().toLowerCase()

  if (status && search) {
    return sql`
      SELECT id, reference_id, submitted_at, status, admin_notes,
             applicant_name, applicant_email, applicant_phone, applicant_location,
             (resume_filename IS NOT NULL) AS has_resume,
             payload->'applicant'->>'roleApplied' AS role_applied
      FROM careers_submissions
      WHERE status = ${status}
        AND (
          lower(reference_id) LIKE ${'%' + search + '%'}
          OR lower(applicant_name) LIKE ${'%' + search + '%'}
          OR lower(applicant_email) LIKE ${'%' + search + '%'}
        )
      ORDER BY submitted_at DESC
      LIMIT ${safeLimit}
    `
  }

  if (status) {
    return sql`
      SELECT id, reference_id, submitted_at, status, admin_notes,
             applicant_name, applicant_email, applicant_phone, applicant_location,
             (resume_filename IS NOT NULL) AS has_resume,
             payload->'applicant'->>'roleApplied' AS role_applied
      FROM careers_submissions
      WHERE status = ${status}
      ORDER BY submitted_at DESC
      LIMIT ${safeLimit}
    `
  }

  if (search) {
    return sql`
      SELECT id, reference_id, submitted_at, status, admin_notes,
             applicant_name, applicant_email, applicant_phone, applicant_location,
             (resume_filename IS NOT NULL) AS has_resume,
             payload->'applicant'->>'roleApplied' AS role_applied
      FROM careers_submissions
      WHERE lower(reference_id) LIKE ${'%' + search + '%'}
         OR lower(applicant_name) LIKE ${'%' + search + '%'}
         OR lower(applicant_email) LIKE ${'%' + search + '%'}
      ORDER BY submitted_at DESC
      LIMIT ${safeLimit}
    `
  }

  return sql`
    SELECT id, reference_id, submitted_at, status, admin_notes,
           applicant_name, applicant_email, applicant_phone, applicant_location,
           (resume_filename IS NOT NULL) AS has_resume,
           payload->'applicant'->>'roleApplied' AS role_applied
    FROM careers_submissions
    ORDER BY submitted_at DESC
    LIMIT ${safeLimit}
  `
}

export async function getSubmissionByReference(referenceId) {
  const sql = getSql()
  if (!sql) return null

  const rows = await sql`
    SELECT id, reference_id, submitted_at, status, admin_notes,
           applicant_name, applicant_email, applicant_phone, applicant_location,
           payload, resume_filename,
           (resume_content IS NOT NULL) AS has_resume
    FROM careers_submissions
    WHERE reference_id = ${referenceId}
    LIMIT 1
  `

  return rows[0] ?? null
}

export async function updateSubmission(referenceId, { status, adminNotes }) {
  const sql = getSql()
  if (!sql) return null

  if (status !== undefined && !SUBMISSION_STATUSES.includes(status)) {
    throw new Error('Invalid status.')
  }

  const rows = await sql`
    UPDATE careers_submissions
    SET
      status = COALESCE(${status ?? null}, status),
      admin_notes = COALESCE(${adminNotes ?? null}, admin_notes)
    WHERE reference_id = ${referenceId}
    RETURNING id, reference_id, submitted_at, status, admin_notes,
              applicant_name, applicant_email, applicant_phone, applicant_location,
              payload, resume_filename,
              (resume_content IS NOT NULL) AS has_resume
  `

  return rows[0] ?? null
}

export async function getResumeByReference(referenceId) {
  const sql = getSql()
  if (!sql) return null

  const rows = await sql`
    SELECT resume_filename, resume_content
    FROM careers_submissions
    WHERE reference_id = ${referenceId}
    LIMIT 1
  `

  const row = rows[0]
  if (!row?.resume_content || !row?.resume_filename) return null

  return {
    filename: row.resume_filename,
    content: row.resume_content,
  }
}

export async function exportSubmissionsCsv({ status, q } = {}) {
  const rows = await listSubmissions({ status, q, limit: 5000 })

  const header = [
    'reference_id',
    'role_applied',
    'applicant_name',
    'applicant_email',
    'applicant_phone',
    'applicant_location',
    'status',
    'submitted_at',
  ]

  function csvEscape(value) {
    const text = String(value ?? '')
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }

  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.reference_id,
        row.role_applied ?? CAREERS_OPEN_ROLE,
        row.applicant_name,
        row.applicant_email,
        row.applicant_phone,
        row.applicant_location,
        row.status,
        row.submitted_at,
      ]
        .map(csvEscape)
        .join(','),
    )
  }

  return lines.join('\n')
}
