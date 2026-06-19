/**
 * Poll target selection for dual-session checkout (embedded A + hosted B).
 * QR / main waiting loop tries hosted B first, then embedded A, then balance.
 * Embedded onComplete verification → embedded session A only.
 */

export function hostedPollSessionId(pollState) {
  return pollState?.hostedSessionId ?? null
}

export function embeddedVerifySessionId(pollState) {
  return pollState?.embeddedSessionId ?? null
}

export function createPollState({
  hostedSessionId = null,
  embeddedSessionId = null,
  balanceBefore = 0,
  creditsToAdd = 0,
}) {
  return {
    hostedSessionId,
    embeddedSessionId,
    balanceBefore,
    creditsToAdd,
    startedAt: Date.now(),
    consecutiveFailures: 0,
    embeddedAttempts: 0,
    completed: false,
    paidConfirmationId: null,
    paidConfirmationSource: null,
  }
}

/**
 * Merge sessionStorage resume with confirmation_id from the paid session's status response.
 * Paid status confirmation_id always wins over sessionStorage (fixes dual-session race).
 */
export function buildCompleteResume(storedResume, paidStatusResponse, paidVia) {
  const resume = storedResume ? { ...storedResume } : null
  const paidId = paidStatusResponse?.confirmation_id ?? null

  if (paidId) {
    const source =
      paidVia === 'embedded'
        ? 'paid-embedded-status'
        : paidVia === 'hosted'
          ? 'paid-hosted-status'
          : 'paid-status'
    return {
      resume: { ...(resume ?? {}), confirmationId: paidId },
      confirmationId: paidId,
      source,
    }
  }

  if (resume?.confirmationId) {
    return {
      resume,
      confirmationId: resume.confirmationId,
      source: 'sessionStorage-fallback',
    }
  }

  return { resume, confirmationId: null, source: 'none' }
}
