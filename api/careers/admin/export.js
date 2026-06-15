import { exportSubmissionsCsv, isCareersStorageEnabled } from '../store.js'
import { requireAdminToken } from '../adminAuth.js'
import { parseQuery } from '../adminUtils.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }

  if (!requireAdminToken(req, res)) return

  if (!isCareersStorageEnabled()) {
    res.status(503).json({ detail: 'Careers storage is not configured.' })
    return
  }

  const params = parseQuery(req.url ?? '')
  const status = params.get('status')?.trim() || undefined
  const q = params.get('q')?.trim() || undefined

  try {
    const csv = await exportSubmissionsCsv({ status, q })
    res.status(200)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="careers-submissions.csv"')
    if (typeof res.send === 'function') {
      res.send(csv)
      return
    }
    res.end(csv)
  } catch (err) {
    console.error(`Careers admin export failed: ${err?.message ?? err}`)
    res.status(500).json({ detail: 'Could not export submissions.' })
  }
}
