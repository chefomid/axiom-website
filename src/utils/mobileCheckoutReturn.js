export const MOBILE_VERIFY_RETRYABLE_MESSAGE =
  'Payment may have succeeded, but we could not verify it from this device yet.'

export const MOBILE_VERIFY_TIMEOUT_MESSAGE =
  'Payment may have succeeded, but verification is taking longer than expected. You can check again in a moment.'

export function sessionIdLogPrefix(sessionId) {
  const id = (sessionId ?? '').trim()
  return id ? `${id.slice(0, 12)}…` : 'unknown'
}

export function isRetryableCheckoutStatusError(err) {
  const status = err?.status
  if (status === 403) return false
  if (status === 502 || status === 503 || status === 429) return true
  if (err?.name === 'TypeError' || err?.message === 'Failed to fetch') return true
  return err?.status === 429 || err?.rateLimit != null
}

export function classifyMobileVerificationFailure(err, { timedOut = false } = {}) {
  if (err?.status === 403) {
    return {
      retryable: false,
      title: 'Something went wrong',
      message: 'This payment session is not valid. Please start checkout again.',
    }
  }

  if (timedOut || isRetryableCheckoutStatusError(err)) {
    return {
      retryable: true,
      title: 'Verification still in progress',
      message: timedOut ? MOBILE_VERIFY_TIMEOUT_MESSAGE : MOBILE_VERIFY_RETRYABLE_MESSAGE,
    }
  }

  return {
    retryable: false,
    title: 'Something went wrong',
    message: err?.message || 'We could not confirm your payment right now. Please try again shortly.',
  }
}
