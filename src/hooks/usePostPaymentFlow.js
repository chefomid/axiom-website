import { useCallback, useRef, useState } from 'react'

import { fetchCheckoutPaymentSummary } from '../services/propertyApi'
import { getOrCreateAnonId } from '../utils/anonId'
import {
  clearPostPaymentContext,
  isReportPostPaymentPurpose,
  savePostPaymentContext,
} from '../utils/postPaymentContext'

const CONFIRMING_MS = 1000

function normalizeBrand(brand) {
  const cleaned = (brand || '').trim()
  if (!cleaned) return 'card'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function usePostPaymentFlow({ runReport, runBatch }) {
  const [phase, setPhase] = useState('idle')
  const [context, setContext] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [refundResult, setRefundResult] = useState(null)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [refundLoading, setRefundLoading] = useState(false)
  const runningRef = useRef(false)

  const updateContext = useCallback(next => {
    setContext(next)
    if (next) savePostPaymentContext(next)
  }, [])

  const resetFlow = useCallback(() => {
    runningRef.current = false
    setPhase('idle')
    setContext(null)
    setErrorMessage('')
    setRefundResult(null)
    setRefundModalOpen(false)
    setRefundLoading(false)
    clearPostPaymentContext()
  }, [])

  const startFlow = useCallback(
    async entry => {
      if (runningRef.current) return
      const purpose = entry?.purpose ?? entry?.resume
      if (!isReportPostPaymentPurpose(purpose)) return

      runningRef.current = true
      const anonId = entry.anonId ?? getOrCreateAnonId()
      const baseContext = {
        ...entry,
        purpose,
        anonId,
        generationAttempted: false,
        refundCompleted: false,
      }

      updateContext(baseContext)
      setErrorMessage('')
      setRefundResult(null)
      setPhase('confirming')

      if (baseContext.sessionId) {
        try {
          const summary = await fetchCheckoutPaymentSummary(baseContext.sessionId, anonId)
          updateContext({
            ...baseContext,
            paymentSummary: {
              brand: normalizeBrand(summary.brand),
              last4: summary.last4 ?? '',
              amountUsd: summary.amount_usd,
            },
            chargeUsd: baseContext.chargeUsd ?? summary.amount_usd,
          })
        } catch {
          // Payment summary is optional for generation; required for refund copy when possible.
        }
      }

      await new Promise(resolve => window.setTimeout(resolve, CONFIRMING_MS))
      if (!runningRef.current) return

      setPhase('generating')
      setContext(prev => {
        const next = { ...(prev ?? baseContext), generationAttempted: true }
        savePostPaymentContext(next)
        return next
      })

      try {
        if (purpose === 'batch_enrich') {
          await runBatch?.(baseContext)
        } else {
          await runReport?.(baseContext)
        }
        setPhase('report')
      } catch (err) {
        setErrorMessage(err?.message ?? 'We could not finish building your report.')
        setPhase('error')
      } finally {
        runningRef.current = false
      }
    },
    [runBatch, runReport, updateContext],
  )

  const completeRefund = useCallback(result => {
    setRefundResult(result)
    setRefundModalOpen(false)
    setRefundLoading(false)
    updateContext(prev => (prev ? { ...prev, refundCompleted: true } : prev))
    setPhase('refunded')
    window.dispatchEvent(new Event('axiom:billing-refresh'))
  }, [updateContext])

  const showRefundEligible =
    phase === 'error' &&
    Boolean(context?.sessionId) &&
    Boolean(context?.generationAttempted) &&
    !context?.refundCompleted

  const overlayActive = phase === 'confirming' || phase === 'generating' || phase === 'error' || phase === 'refunded'

  return {
    phase,
    context,
    errorMessage,
    refundResult,
    refundModalOpen,
    refundLoading,
    showRefundEligible,
    overlayActive,
    startFlow,
    resetFlow,
    setRefundModalOpen,
    setRefundLoading,
    completeRefund,
  }
}
