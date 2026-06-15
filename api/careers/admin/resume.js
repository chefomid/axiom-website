import { getResumeByReference, isCareersStorageEnabled } from '../store.js'
import { requireAdminToken } from '../adminAuth.js'
import { parseQuery } from '../adminUtils.js'

function guessContentType(filename) {
  const lower = String(filename).toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.txt')) return 'text/plain'
  return 'application/octet-stream'
}

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
  const referenceId = params.get('referenceId')?.trim()
  if (!referenceId) {
    res.status(400).json({ detail: 'referenceId is required.' })
    return
  }

  try {
    const resume = await getResumeByReference(referenceId)
    if (!resume) {
      res.status(404).json({ detail: 'Resume not found.' })
      return
    }

    const buffer = Buffer.isBuffer(resume.content)
      ? resume.content
      : Buffer.from(resume.content)

    const contentType = guessContentType(resume.filename)

    res.status(200)
    res.setHeader('Content-Type', contentType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resume.filename.replace(/"/g, '')}"`,
    )
    if (typeof res.send === 'function') {
      res.send(buffer)
      return
    }
    res.end(buffer)
  } catch (err) {
    console.error(`Careers admin resume failed: ${err?.message ?? err}`)
    res.status(500).json({ detail: 'Could not download resume.' })
  }
}
