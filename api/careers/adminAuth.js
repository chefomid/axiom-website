export function getAdminToken() {
  return process.env.CAREERS_ADMIN_TOKEN?.trim() || ''
}

export function isAdminConfigured() {
  return Boolean(getAdminToken())
}

export function readBearerToken(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization ?? ''
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

export function requireAdminToken(req, res) {
  const expected = getAdminToken()
  if (!expected) {
    res.status(503).json({ detail: 'Admin access is not configured.' })
    return false
  }

  const token = readBearerToken(req)
  if (!token || token !== expected) {
    res.status(401).json({ detail: 'Unauthorized.' })
    return false
  }

  return true
}
