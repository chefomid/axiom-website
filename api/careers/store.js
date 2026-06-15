import {
  SUBMISSION_STATUSES,
  ensureCareersSchema,
  exportSubmissionsCsv as exportDbSubmissionsCsv,
  getResumeByReference as getDbResumeByReference,
  getSubmissionByReference as getDbSubmissionByReference,
  insertSubmission as insertDbSubmission,
  isCareersDbEnabled,
  listSubmissions as listDbSubmissions,
  updateSubmission as updateDbSubmission,
} from './db.js'
import {
  ensureLocalStoreReady,
  exportLocalSubmissionsCsv,
  getLocalResumeByReference,
  getLocalSubmissionByReference,
  insertLocalSubmission,
  listLocalSubmissions,
  updateLocalSubmission,
} from './localStore.js'

export { SUBMISSION_STATUSES }

export function isLocalCareersStore() {
  return !isCareersDbEnabled() && process.env.NODE_ENV === 'development'
}

export function isCareersStorageEnabled() {
  return isCareersDbEnabled() || isLocalCareersStore()
}

export function careersStorageNotConfiguredMessage() {
  if (process.env.NODE_ENV === 'production') {
    return 'Application storage is not configured. Set CAREERS_DATABASE_URL or connect Neon Postgres on Vercel.'
  }
  return 'Application storage is not configured. Run the Vite dev server locally or set CAREERS_DATABASE_URL.'
}

export async function ensureStorageReady() {
  if (isCareersDbEnabled()) {
    return ensureCareersSchema()
  }
  if (isLocalCareersStore()) {
    return ensureLocalStoreReady()
  }
  return false
}

export async function insertSubmission(args) {
  if (isCareersDbEnabled()) {
    return insertDbSubmission(args)
  }
  if (isLocalCareersStore()) {
    return insertLocalSubmission(args)
  }
  return null
}

export async function listSubmissions(options) {
  if (isCareersDbEnabled()) {
    return listDbSubmissions(options)
  }
  if (isLocalCareersStore()) {
    return listLocalSubmissions(options)
  }
  return []
}

export async function getSubmissionByReference(referenceId) {
  if (isCareersDbEnabled()) {
    return getDbSubmissionByReference(referenceId)
  }
  if (isLocalCareersStore()) {
    return getLocalSubmissionByReference(referenceId)
  }
  return null
}

export async function updateSubmission(referenceId, patch) {
  if (isCareersDbEnabled()) {
    return updateDbSubmission(referenceId, patch)
  }
  if (isLocalCareersStore()) {
    return updateLocalSubmission(referenceId, patch)
  }
  return null
}

export async function getResumeByReference(referenceId) {
  if (isCareersDbEnabled()) {
    return getDbResumeByReference(referenceId)
  }
  if (isLocalCareersStore()) {
    return getLocalResumeByReference(referenceId)
  }
  return null
}

export async function exportSubmissionsCsv(options) {
  if (isCareersDbEnabled()) {
    return exportDbSubmissionsCsv(options)
  }
  if (isLocalCareersStore()) {
    return exportLocalSubmissionsCsv(options)
  }
  return ''
}
