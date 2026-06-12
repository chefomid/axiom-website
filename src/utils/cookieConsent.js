export const CONSENT_STORAGE_KEY = 'axiom:cookie-consent'
export const CONSENT_POLICY_VERSION = '1.0.0'
export const OPEN_PREFERENCES_EVENT = 'axiom:open-cookie-preferences'

const CONSENT_ACTIONS = {
  ACCEPT_ALL: 'accept_all',
  REJECT_NON_ESSENTIAL: 'reject_non_essential',
  CUSTOM: 'custom',
}

function readRaw() {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeRecord(record) {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
    return record
  } catch {
    return record
  }
}

function buildRecord({ analytics, marketing, action }) {
  return {
    policyVersion: CONSENT_POLICY_VERSION,
    decidedAt: new Date().toISOString(),
    necessary: true,
    analytics: Boolean(analytics),
    marketing: Boolean(marketing),
    action,
  }
}

export function isGlobalPrivacyControlEnabled() {
  try {
    return navigator.globalPrivacyControl === true
  } catch {
    return false
  }
}

export function getConsent() {
  const raw = readRaw()
  if (!raw || raw.policyVersion !== CONSENT_POLICY_VERSION) return null
  return raw
}

export function hasConsentDecision() {
  return getConsent() !== null
}

export function acceptAll() {
  return writeRecord(
    buildRecord({
      analytics: true,
      marketing: true,
      action: CONSENT_ACTIONS.ACCEPT_ALL,
    }),
  )
}

export function rejectNonEssential() {
  return writeRecord(
    buildRecord({
      analytics: false,
      marketing: false,
      action: CONSENT_ACTIONS.REJECT_NON_ESSENTIAL,
    }),
  )
}

export function saveCustomPreferences({ analytics, marketing }) {
  return writeRecord(
    buildRecord({
      analytics,
      marketing,
      action: CONSENT_ACTIONS.CUSTOM,
    }),
  )
}

export function optOutOfSaleOrShare() {
  const existing = getConsent()
  return saveCustomPreferences({
    analytics: existing?.analytics ?? false,
    marketing: false,
  })
}

/** Apply GPC on first visit when no prior consent exists. */
export function applyGlobalPrivacyControlIfNeeded() {
  if (hasConsentDecision()) return getConsent()
  if (!isGlobalPrivacyControlEnabled()) return null
  return rejectNonEssential()
}

export function openPreferences() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT))
}
