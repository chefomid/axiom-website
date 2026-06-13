import { isCareersDbEnabled, listSubmissions } from '../db.js'
import { requireAdminToken } from '../adminAuth.js'
import { parseQuery, serializeSubmission } from '../adminUtils.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }

  if (!requireAdminToken(req, res)) return

  if (!isCareersDbEnabled()) {
    res.status(503).json({ detail: 'Careers database is not configured.' })
    return
  }

  const params = parseQuery(req.url ?? '')
  const status = params.get('status')?.trim() || undefined
  const q = params.get('q')?.trim() || undefined

  try {
    const rows = await listSubmissions({ status, q })
    res.status(200).json({
      submissions: rows.map(row => serializeSubmission(row)),
    })
  } catch (err) {
    console.error(`Careers admin list failed: ${err?.message ?? err}`)
    res.status(500).json({ detail: 'Could not load submissions.' })
  }
}
