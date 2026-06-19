import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { usePostPaymentFlow } from '../../hooks/usePostPaymentFlow'
import {
  enrichBatch,
  enrichProperty,
  fetchCheckoutStatus,
  requestCheckoutRefund,
} from '../../services/propertyApi'
import { adoptAnonIdFromSearchParams, getOrCreateAnonId } from '../../utils/anonId'
import { formatBillingError } from '../../utils/apiErrors'
import { loadBillingResume, clearBillingResume } from '../../utils/billingResume'
import {
  classifyMobileVerificationFailure,
  isRetryableCheckoutStatusError,
  sessionIdLogPrefix,
} from '../../utils/mobileCheckoutReturn'
import { isReportPostPaymentPurpose } from '../../utils/postPaymentContext'
import PostPaymentOverlay from './PostPaymentOverlay'
import RefundConfirmModal from './RefundConfirmModal'
import ConfirmationNumberCopy from './ConfirmationNumberCopy'

const MOBILE_POLL_FAST_MS = 2000
const MOBILE_POLL_SLOW_MS = 2000
const MOBILE_POLL_FAST_ATTEMPTS = 30
const MOBILE_POLL_MAX_ATTEMPTS = 60

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

async function waitForPaid(sessionId, anonId, cancelledRef) {
  for (let attempt = 0; attempt < MOBILE_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (cancelledRef.current) return null

    try {
      const status = await fetchCheckoutStatus(sessionId, anonId)
      if (status.status === 'paid') {
        return { paid: true, confirmationId: status.confirmation_id ?? null, statusResponse: status }
      }
    } catch (err) {
      if (cancelledRef.current) return null
      const httpStatus = err?.status ?? 'unknown'
      if (httpStatus === 429) {
        console.warn('[checkout] mobile checkout-status rate limited (HTTP 429); retrying.')
      } else if (httpStatus === 502 || httpStatus === 503) {
        console.warn(
          `[checkout] mobile checkout-status unavailable (HTTP ${httpStatus}), retrying...`,
          err?.message ?? err,
        )
      } else if (!isRetryableCheckoutStatusError(err)) {
        throw err
      }
    }

    const delay = attempt < MOBILE_POLL_FAST_ATTEMPTS ? MOBILE_POLL_FAST_MS : MOBILE_POLL_SLOW_MS
    await new Promise(resolve => window.setTimeout(resolve, delay))
  }

  return { paid: false, confirmationId: null, timedOut: true }
}

export default function MobilePaymentReturn() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [phase, setPhase] = useState('verifying')
  const [errorTitle, setErrorTitle] = useState('Something went wrong')
  const [error, setError] = useState(null)
  const [errorRetryable, setErrorRetryable] = useState(false)
  const [checkingAgain, setCheckingAgain] = useState(false)
  const [confirmationId, setConfirmationId] = useState(null)
  const cancelledRef = useRef(false)
  const completedRef = useRef(false)
  const startPostPaymentRef = useRef(null)

  const sessionId = searchParams.get('session_id')?.trim() ?? ''
  const billing = searchParams.get('billing')
  const urlAnonId = searchParams.get('anon_id')?.trim() ?? ''

  const runMobileReport = useCallback(async ctx => {
    await enrichProperty({
      address: ctx.address,
      selectedSources: ctx.selectedSources ?? [],
      sourceUrls: ctx.sourceUrls,
      confirmedPriceUsd: ctx.confirmedPriceUsd ?? ctx.chargeUsd,
      reportId: ctx.confirmationId,
      anonId: ctx.anonId,
    })
  }, [])

  const runMobileBatch = useCallback(async ctx => {
    const confirmedPrice =
      ctx.confirmedPriceUsd ?? ctx.batchQuoteSnapshot?.totals?.user_price_usd ?? ctx.chargeUsd
    await enrichBatch({
      addresses: ctx.addresses ?? [],
      selectedSources: ctx.selectedSources ?? [],
      confirmedPriceUsd: confirmedPrice,
      batchId: ctx.confirmationId,
      anonId: ctx.anonId,
    })
  }, [])

  const {
    phase: postPaymentPhase,
    context: postPaymentContext,
    errorMessage: postPaymentError,
    refundResult: postPaymentRefundResult,
    refundModalOpen,
    refundLoading,
    showRefundEligible,
    overlayActive: postPaymentOverlayActive,
    startFlow: startPostPaymentFlow,
    resetFlow: resetPostPaymentFlow,
    setRefundModalOpen,
    setRefundLoading,
    completeRefund,
  } = usePostPaymentFlow({
    runReport: runMobileReport,
    runBatch: runMobileBatch,
  })

  startPostPaymentRef.current = startPostPaymentFlow

  const clearParams = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('billing')
    next.delete('session_id')
    next.delete('anon_id')
    next.delete('resume')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const handleConfirmRefund = useCallback(async () => {
    const sid = postPaymentContext?.sessionId
    const anonId = postPaymentContext?.anonId
    if (!sid || !anonId) return
    setRefundLoading(true)
    try {
      const result = await requestCheckoutRefund(sid, anonId)
      completeRefund(result)
    } catch {
      setRefundLoading(false)
    }
  }, [completeRefund, postPaymentContext, setRefundLoading])

  const runVerification = useCallback(async () => {
    if (billing !== 'success' || !sessionId) {
      setPhase('error')
      setErrorTitle('Something went wrong')
      setError('This payment link is not valid.')
      setErrorRetryable(false)
      return
    }

    const anonId = urlAnonId || getOrCreateAnonId()
    console.info('[checkout] mobile return verifying session:', sessionIdLogPrefix(sessionId))

    setPhase('verifying')
    setError(null)
    setErrorRetryable(false)
    setErrorTitle('Something went wrong')

    try {
      const result = await waitForPaid(sessionId, anonId, cancelledRef)
      if (cancelledRef.current) return

      if (result?.paid) {
        completedRef.current = true
        window.dispatchEvent(new Event('axiom:billing-refresh'))
        const resumeData = loadBillingResume()
        const purpose = resumeData?.resume ?? searchParams.get('resume') ?? null
        clearBillingResume()
        clearParams()

        if (isReportPostPaymentPurpose(purpose) && resumeData) {
          void startPostPaymentRef.current?.({
            ...resumeData,
            purpose,
            sessionId,
            confirmationId: result.confirmationId ?? resumeData.confirmationId ?? null,
            creditsAdded: result.statusResponse?.credits_added ?? null,
            anonId,
          })
          return
        }

        setConfirmationId(result.confirmationId)
        setPhase('done')
        return
      }

      const failure = classifyMobileVerificationFailure(null, { timedOut: Boolean(result?.timedOut) })
      setErrorTitle(failure.title)
      setError(failure.message)
      setErrorRetryable(failure.retryable)
      setPhase('error')
    } catch (err) {
      if (cancelledRef.current) return
      console.warn('[checkout] mobile payment confirmation failed:', err?.status, err?.message ?? err)
      const failure = classifyMobileVerificationFailure(err)
      if (!failure.retryable && err) {
        failure.message = formatBillingError(err, failure.message)
      }
      setErrorTitle(failure.title)
      setError(failure.message)
      setErrorRetryable(failure.retryable)
      setPhase('error')
    } finally {
      setCheckingAgain(false)
    }
  }, [billing, sessionId, urlAnonId, clearParams, searchParams])

  useEffect(() => {
    adoptAnonIdFromSearchParams(searchParams)
  }, [searchParams])

  useEffect(() => {
    if (completedRef.current) return undefined

    if (billing !== 'success' || !sessionId) {
      setPhase('error')
      setErrorTitle('Something went wrong')
      setError('This payment link is not valid.')
      setErrorRetryable(false)
      return undefined
    }

    cancelledRef.current = false
    void runVerification()
    return () => {
      cancelledRef.current = true
    }
  }, [billing, sessionId, urlAnonId, runVerification])

  const handleCheckAgain = useCallback(() => {
    if (completedRef.current) return
    cancelledRef.current = false
    setCheckingAgain(true)
    void runVerification()
  }, [runVerification])

  if (postPaymentOverlayActive) {
    return (
      <>
        <PostPaymentOverlay
          phase={postPaymentPhase}
          context={postPaymentContext}
          errorMessage={postPaymentError}
          refundResult={postPaymentRefundResult}
          showRefundEligible={showRefundEligible}
          onRequestRefund={() => setRefundModalOpen(true)}
          onDismiss={resetPostPaymentFlow}
        />
        <RefundConfirmModal
          open={refundModalOpen}
          loading={refundLoading}
          paymentSummary={postPaymentContext?.paymentSummary}
          onCancel={() => setRefundModalOpen(false)}
          onConfirm={() => void handleConfirmRefund()}
        />
      </>
    )
  }

  if (postPaymentPhase === 'report') {
    const reportConfirmation = postPaymentContext?.confirmationId ?? confirmationId
    return (
      <MobileShell>
        <div className="mx-4 mt-10 px-2 text-center">
          <p className="font-display text-2xl font-semibold text-white">Report ready</p>
          <p className="mt-2 font-sans text-sm text-ink-secondary">Your property intelligence report is complete.</p>
          {reportConfirmation ? (
            <div className="mx-auto mt-8 max-w-sm text-left">
              <ConfirmationNumberCopy confirmationId={reportConfirmation} />
              <p className="mt-4 text-center font-sans text-xs leading-relaxed text-ink-faint">
                Open Property Intelligence on desktop to view the full report.
              </p>
            </div>
          ) : null}
        </div>
      </MobileShell>
    )
  }

  if (phase === 'verifying') {
    return (
      <MobileShell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <span className="street-view-spinner mb-4 h-5 w-5" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">Confirming payment</p>
          <p className="mt-2 font-sans text-sm text-ink-secondary">
            {checkingAgain ? 'Checking payment status again…' : 'This usually takes a few seconds.'}
          </p>
        </div>
      </MobileShell>
    )
  }

  if (phase === 'error') {
    return (
      <MobileShell>
        <div className="mx-4 mt-8 rounded-lg border border-panel-border bg-panel-surface/30 px-5 py-6 text-center">
          <p className="font-display text-lg font-semibold text-white">{errorTitle}</p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-ink-secondary">{error}</p>
          <div className="mt-6 flex flex-col items-center gap-3">
            {errorRetryable ? (
              <button
                type="button"
                onClick={handleCheckAgain}
                disabled={checkingAgain}
                className="inline-flex min-h-[44px] items-center justify-center rounded border border-panel-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:border-[#444] hover:text-white disabled:opacity-60"
              >
                {checkingAgain ? 'Checking…' : 'Check again'}
              </button>
            ) : null}
            <Link
              to="/property-intelligence"
              className="inline-flex min-h-[44px] items-center justify-center rounded border border-panel-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary no-underline transition-colors hover:border-[#444] hover:text-white"
            >
              Back to overview
            </Link>
          </div>
        </div>
      </MobileShell>
    )
  }

  return (
    <MobileShell>
      <div className="mx-4 mt-10 px-2 text-center">
        <p className="font-display text-2xl font-semibold text-white">Thank you</p>
        <p className="mt-2 font-sans text-sm text-ink-secondary">Payment received.</p>
        <p className="mt-1 font-sans text-sm text-ink-muted">Your credits have been added.</p>
      </div>
    </MobileShell>
  )
}
