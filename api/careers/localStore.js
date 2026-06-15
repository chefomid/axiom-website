import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { SUBMISSION_STATUSES } from './db.js'

const DATA_ROOT = path.join(process.cwd(), '.careers-data')
const SUBMISSIONS_DIR = path.join(DATA_ROOT, 'submissions')
const RESUMES_DIR = path.join(DATA_ROOT, 'resumes')

function submissionPath(referenceId) {
  return path.join(SUBMISSIONS_DIR, `${referenceId}.json`)
}

function resumePath(referenceId) {
  return path.join(RESUMES_DIR, referenceId)
}

async function readSubmissionFile(referenceId) {
  try {
    const raw = await fs.readFile(submissionPath(referenceId), 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
}

async function listSubmissionFiles() {
  try {
    const names = await fs.readdir(SUBMISSIONS_DIR)
    return names.filter(name => name.endsWith('.json'))
  } catch (err) {
    if (err?.code === 'ENOENT') return []
    throw err
  }
}

function matchesFilters(row, { status, search }) {
  if (status && row.status !== status) return false
  if (search) {
    const haystack = [
      row.reference_id,
      row.applicant_name,
      row.applicant_email,
    ]
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(search)) return false
  }
  return true
}

export async function ensureLocalStoreReady() {
  await fs.mkdir(SUBMISSIONS_DIR, { recursive: true })
  await fs.mkdir(RESUMES_DIR, { recursive: true })
  return true
}

export async function insertLocalSubmission({
  referenceId,
  submittedAt,
  applicant,
  sections,
  attachment,
}) {
  const payload = { applicant, sections }
  let resumeFilename = null
  let hasResume = false

  if (attachment?.content && attachment?.filename) {
    resumeFilename = attachment.filename
    hasResume = true
    const resumeBuffer = Buffer.from(attachment.content, 'base64')
    await fs.writeFile(resumePath(referenceId), resumeBuffer)
  }

  const record = {
    id: randomUUID(),
    reference_id: referenceId,
    submitted_at: submittedAt,
    status: 'new',
    admin_notes: null,
    applicant_name: applicant.fullName,
    applicant_email: applicant.email,
    applicant_phone: applicant.phone || null,
    applicant_location: applicant.location || null,
    payload,
    resume_filename: resumeFilename,
    has_resume: hasResume,
  }

  await fs.writeFile(submissionPath(referenceId), JSON.stringify(record, null, 2), 'utf8')

  return {
    id: record.id,
    reference_id: record.reference_id,
    submitted_at: record.submitted_at,
    status: record.status,
  }
}

export async function listLocalSubmissions({ status, q, limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const search = String(q ?? '').trim().toLowerCase()
  const files = await listSubmissionFiles()
  const rows = []

  for (const file of files) {
    const referenceId = file.replace(/\.json$/, '')
    const row = await readSubmissionFile(referenceId)
    if (!row) continue
    if (!matchesFilters(row, { status, search })) continue
    rows.push({
      id: row.id,
      reference_id: row.reference_id,
      submitted_at: row.submitted_at,
      status: row.status,
      admin_notes: row.admin_notes,
      applicant_name: row.applicant_name,
      applicant_email: row.applicant_email,
      applicant_phone: row.applicant_phone,
      applicant_location: row.applicant_location,
      has_resume: Boolean(row.has_resume),
    })
  }

  rows.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
  return rows.slice(0, safeLimit)
}

export async function getLocalSubmissionByReference(referenceId) {
  const row = await readSubmissionFile(referenceId)
  if (!row) return null

  return {
    id: row.id,
    reference_id: row.reference_id,
    submitted_at: row.submitted_at,
    status: row.status,
    admin_notes: row.admin_notes,
    applicant_name: row.applicant_name,
    applicant_email: row.applicant_email,
    applicant_phone: row.applicant_phone,
    applicant_location: row.applicant_location,
    payload: row.payload,
    resume_filename: row.resume_filename,
    has_resume: Boolean(row.has_resume),
  }
}

export async function updateLocalSubmission(referenceId, { status, adminNotes }) {
  const row = await readSubmissionFile(referenceId)
  if (!row) return null

  if (status !== undefined && !SUBMISSION_STATUSES.includes(status)) {
    throw new Error('Invalid status.')
  }

  if (status !== undefined) row.status = status
  if (adminNotes !== undefined) row.admin_notes = adminNotes

  await fs.writeFile(submissionPath(referenceId), JSON.stringify(row, null, 2), 'utf8')

  return {
    id: row.id,
    reference_id: row.reference_id,
    submitted_at: row.submitted_at,
    status: row.status,
    admin_notes: row.admin_notes,
    applicant_name: row.applicant_name,
    applicant_email: row.applicant_email,
    applicant_phone: row.applicant_phone,
    applicant_location: row.applicant_location,
    payload: row.payload,
    resume_filename: row.resume_filename,
    has_resume: Boolean(row.has_resume),
  }
}

export async function getLocalResumeByReference(referenceId) {
  const row = await readSubmissionFile(referenceId)
  if (!row?.has_resume || !row.resume_filename) return null

  try {
    const content = await fs.readFile(resumePath(referenceId))
    return {
      filename: row.resume_filename,
      content,
    }
  } catch (err) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
}

export async function exportLocalSubmissionsCsv({ status, q } = {}) {
  const rows = await listLocalSubmissions({ status, q, limit: 5000 })

  const header = [
    'reference_id',
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
