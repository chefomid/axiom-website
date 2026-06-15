import { timingSafeEqual } from 'node:crypto'

export function getAdminToken() {
  return process.env.CAREERS_ADMIN_TOKEN?.trim() || ''
}

export function getAdminUsername() {
  return process.env.CAREERS_ADMIN_USERNAME?.trim() || ''
}

export function getAdminPassword() {
  return process.env.CAREERS_ADMIN_PASSWORD ?? ''
}

function safeEqual(a, b) {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function validateAdminCredentials(username, password) {
  const expectedUser = getAdminUsername()
  const expectedPass = getAdminPassword()
  if (!expectedUser || !expectedPass) return false
  return safeEqual(username.trim(), expectedUser) && safeEqual(password, expectedPass)
}

export function isAdminConfigured() {
  return Boolean(getAdminToken())
}

export function isAdminLoginConfigured() {
  return Boolean(getAdminToken() && getAdminUsername() && getAdminPassword())
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
