import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { fetchCheckoutStatus } from '../../services/propertyApi'
import { adoptAnonIdFromSearchParams, getOrCreateAnonId } from '../../utils/anonId'
import { formatBillingError, isRateLimitError } from '../../utils/apiErrors'

const MOBILE_POLL_FAST_MS = 2000
const MOBILE_POLL_SLOW_MS = 2000
const MOBILE_POLL_FAST_ATTEMPTS = 30
const MOBILE_POLL_MAX_ATTEMPTS = 60

function isRetryableCheckoutStatusError(err) {
  const status = err?.status
  if (status === 403) return false
  if (status === 502 || status === 503 || status === 429) return true
  if (err?.name === 'TypeError' || err?.message === 'Failed to fetch') return true
  return isRateLimitError(err)
}

function MobileShell({ children }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-black font-sans text-ink-primary">
      <header className="shrink-0 border-b border-panel-border bg-[#060606]/95 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#2a2a2a] text-ink-muted transition-colors hover:border-[#444] hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M11 4L6 9l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">Property Intelligence</p>
            <p className="font-display truncate text-sm font-semibold text-white">Payment</p>
          </div>
        </div>
      </header>
      <main className="sleek-scrollbar flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [value])

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="ml-2 rounded border border-panel-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary transition-colors hover:border-[#444] hover:text-white"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function MobilePaymentReturn() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [phase, setPhase] = useState('verifying')
  const [error, setError] = useState(null)
  const [confirmationId, setConfirmationId] = useState(null)

  const sessionId = searchParams.get('session_id')?.trim() ?? ''
  const billing = searchParams.get('billing')
  const urlAnonId = searchParams.get('anon_id')?.trim() ?? ''

  const clearParams = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('billing')
    next.delete('session_id')
    next.delete('anon_id')
    next.delete('resume')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    adoptAnonIdFromSearchParams(searchParams)
  }, [searchParams])

  useEffect(() => {
    if (billing !== 'success' || !sessionId) {
      setPhase('error')
      setError('This payment link is not valid.')
      return undefined
    }

    let cancelled = false
    const anonId = urlAnonId || getOrCreateAnonId()

    async function waitForPaid() {
      for (let attempt = 0; attempt < MOBILE_POLL_MAX_ATTEMPTS; attempt += 1) {
        try {
          const status = await fetchCheckoutStatus(sessionId, anonId)
          if (status.status === 'paid') {
            return { paid: true, confirmationId: status.confirmation_id ?? null }
          }
        } catch (err) {
          if (cancelled) return null
          const httpStatus = err?.status ?? 'unknown'
          if (httpStatus === 429) {
            console.warn('[checkout] mobile checkout-status rate limited (HTTP 429); retrying.')
          } else if (httpStatus === 502 || httpStatus === 503) {
            console.warn(
              `[checkout] mobile checkout-status unavailable (HTTP ${httpStatus}); retrying.`,
              err?.message ?? err,
            )
          } else if (!isRetryableCheckoutStatusError(err)) {
            throw err
          }
        }
        const delay = attempt < MOBILE_POLL_FAST_ATTEMPTS ? MOBILE_POLL_FAST_MS : MOBILE_POLL_SLOW_MS
        await new Promise(resolve => window.setTimeout(resolve, delay))
        if (cancelled) return null
      }
      return { paid: false, confirmationId: null }
    }

    async function run() {
      try {
        const result = await waitForPaid()
        if (cancelled) return
        if (!result?.paid) {
          setPhase('error')
          setError(
            'Payment is taking longer than expected. Save your receipt email and try retrieving your report later.',
          )
          return
        }
        setConfirmationId(result.confirmationId)
        setPhase('done')
        clearParams()
      } catch (err) {
        if (cancelled) return
        console.warn('[checkout] mobile payment confirmation failed:', err?.status, err?.message ?? err)
        setPhase('error')
        setError(formatBillingError(err, 'We could not confirm your payment right now. Please try again shortly.'))
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [billing, sessionId, urlAnonId, clearParams])

  if (phase === 'verifying') {
    return (
      <MobileShell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <span className="street-view-spinner mb-4 h-5 w-5" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">Confirming payment</p>
          <p className="mt-2 font-sans text-sm text-ink-secondary">This usually takes a few seconds.</p>
        </div>
      </MobileShell>
    )
  }

  if (phase === 'error') {
    return (
      <MobileShell>
        <div className="mx-4 mt-8 rounded-lg border border-panel-border bg-panel-surface/30 px-5 py-6 text-center">
          <p className="font-display text-lg font-semibold text-white">Something went wrong</p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-ink-secondary">{error}</p>
          <Link
            to="/property-intelligence"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded border border-panel-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary no-underline"
          >
            Back to overview
          </Link>
        </div>
      </MobileShell>
    )
  }

  return (
    <MobileShell>
      <div className="mx-4 mt-10 px-2 text-center">
        <p className="font-display text-2xl font-semibold text-white">Thank you</p>
        <p className="mt-2 font-sans text-sm text-ink-secondary">Payment received.</p>
        <p className="mt-1 font-sans text-sm text-ink-muted">
          {confirmationId ? 'Your report is being prepared.' : 'Your credits have been added.'}
        </p>

        {confirmationId ? (
          <div className="mx-auto mt-8 max-w-sm rounded-lg border border-panel-border bg-panel-surface/40 px-5 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Confirmation</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
              <span className="font-mono text-lg tabular-nums tracking-wide text-command-live">
                {confirmationId}
              </span>
              <CopyButton value={confirmationId} />
            </div>
            <p className="mt-4 font-sans text-xs leading-relaxed text-ink-faint">
              Save this number to retrieve your report anytime.
            </p>
          </div>
        ) : null}
      </div>
    </MobileShell>
  )
}
