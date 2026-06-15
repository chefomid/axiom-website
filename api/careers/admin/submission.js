import { ensureStorageReady, getSubmissionByReference, isCareersStorageEnabled, updateSubmission } from '../store.js'
import { requireAdminToken } from '../adminAuth.js'
import { parseQuery, serializeSubmission } from '../adminUtils.js'

export default async function handler(req, res) {
  if (!requireAdminToken(req, res)) return

  if (!isCareersStorageEnabled()) {
    res.status(503).json({ detail: 'Careers storage is not configured.' })
    return
  }

  const params = parseQuery(req.url ?? '')
  const referenceId = params.get('referenceId')?.trim()
  if (!referenceId) {
    res.status(400).json({ detail: 'referenceId is required.' })
    return
  }

  if (req.method === 'GET') {
    try {
      await ensureStorageReady()
      const row = await getSubmissionByReference(referenceId)
      if (!row) {
        res.status(404).json({ detail: 'Submission not found.' })
        return
      }
      res.status(200).json({ submission: serializeSubmission(row, { includePayload: true }) })
    } catch (err) {
      console.error(`Careers admin detail failed: ${err?.message ?? err}`)
      res.status(500).json({ detail: 'Could not load submission.' })
    }
    return
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {}
    const status = typeof body.status === 'string' ? body.status.trim() : undefined
    const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined

    if (status === undefined && adminNotes === undefined) {
      res.status(400).json({ detail: 'Nothing to update.' })
      return
    }

    try {
      await ensureStorageReady()
      const row = await updateSubmission(referenceId, { status, adminNotes })
      if (!row) {
        res.status(404).json({ detail: 'Submission not found.' })
        return
      }
      res.status(200).json({ submission: serializeSubmission(row, { includePayload: true }) })
    } catch (err) {
      console.error(`Careers admin update failed: ${err?.message ?? err}`)
      res.status(400).json({ detail: err?.message ?? 'Could not update submission.' })
    }
    return
  }

  res.status(405).json({ detail: 'Method not allowed' })
}
