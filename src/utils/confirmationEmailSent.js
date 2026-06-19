function storageKey(confirmationId) {
  return `axiom:confirmation-email:${confirmationId.trim().toUpperCase()}`
}

export function isConfirmationEmailSent(confirmationId) {
  if (!confirmationId?.trim()) return true
  try {
    return sessionStorage.getItem(storageKey(confirmationId)) === '1'
  } catch {
    return false
  }
}

export function markConfirmationEmailSent(confirmationId) {
  if (!confirmationId?.trim()) return
  try {
    sessionStorage.setItem(storageKey(confirmationId), '1')
  } catch {
    // ignore storage failures
  }
}
