import { checkRateLimit } from '../../lib/rateLimit.js'
import {
  getAdminToken,
  isAdminLoginConfigured,
  validateAdminCredentials,
} from '../adminAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }

  if (
    !checkRateLimit(req, res, {
      route: 'careers:admin-login',
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })
  ) {
    return
  }

  if (!isAdminLoginConfigured()) {
    res.status(503).json({ detail: 'Admin login is not configured.' })
    return
  }

  const body = req.body
  if (!body || typeof body !== 'object') {
    res.status(400).json({ detail: 'Invalid payload.' })
    return
  }

  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')

  if (!username || !password) {
    res.status(400).json({ detail: 'Username and password are required.' })
    return
  }

  if (!validateAdminCredentials(username, password)) {
    res.status(401).json({ detail: 'Invalid credentials.' })
    return
  }

  res.status(200).json({ ok: true, token: getAdminToken() })
}
