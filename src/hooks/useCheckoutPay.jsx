import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import CheckoutPayModal from '../components/property-intelligence/CheckoutPayModal'
import { useIsLgUp } from './useMediaQuery'
import { fetchBillingBalance, fetchBillingPacks, fetchCheckoutStatus } from '../services/propertyApi'
import { getOrCreateAnonId } from '../utils/anonId'
import { loadBillingResume } from '../utils/billingResume'
import { getStripePromise } from '../utils/stripeClient'

// 2000ms keeps checkout-status under the API rate limit (~30 req/min fast phase).
const FAST_POLL_MS = 2000
const SLOW_POLL_MS = 2000
const FAST_POLL_DURATION_MS = 60_000
const POLL_TIMEOUT_MS = 15 * 60 * 1000
const MAX_CONSECUTIVE_FAILURES = 5

const CheckoutPayContext = createContext(null)

export function CheckoutPayProvider({ children }) {
  const isDesktop = useIsLgUp()
  const [modal, setModal] = useState(null)
  const [waiting, setWaiting] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [pollTrouble, setPollTrouble] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [stripePublishableKey, setStripePublishableKey] = useState('')
  const [phoneUrlLoading, setPhoneUrlLoading] = useState(false)
  const pollRef = useRef(null)
  const timeoutRef = useRef(null)
  const pollStateRef = useRef(null)
  const onCompleteRef = useRef(null)
  const onCancelRef = useRef(null)
  const bootstrapIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetchBillingPacks()
      .then(data => {
        const key = data.stripe_publishable_key ?? ''
        if (!cancelled) {
          setStripePublishableKey(key)
          if (key) getStripePromise(key)
        }
      })
      .catch(() => {
        if (!cancelled) setStripePublishableKey('')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current)
      pollRef.current = null
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pollStateRef.current = null
  }, [])

  const closeModal = useCallback(() => {
    bootstrapIdRef.current += 1
    clearPolling()
    onCancelRef.current?.()
    setModal(null)
    setWaiting(false)
    setTimedOut(false)
    setPollTrouble(false)
    setCheckingStatus(false)
    setPhoneUrlLoading(false)
    onCompleteRef.current = null
    onCancelRef.current = null
  }, [clearPolling])

  const completeCheckout = useCallback(() => {
    const onComplete = onCompleteRef.current
    const resume = loadBillingResume()
    bootstrapIdRef.current += 1
    clearPolling()
    setModal(null)
    setWaiting(false)
    setTimedOut(false)
    setPollTrouble(false)
    setCheckingStatus(false)
    setPhoneUrlLoading(false)
    onCompleteRef.current = null
    onCancelRef.current = null
    window.dispatchEvent(new Event('axiom:billing-refresh'))
    onComplete?.(resume)
  }, [clearPolling])

  const pollPaymentOnce = useCallback(async () => {
    const state = pollStateRef.current
    if (!state) return false

    const anonId = getOrCreateAnonId()
    const { hostedSessionId, balanceBefore, creditsToAdd } = state
    let paid = false

    if (hostedSessionId) {
      try {
        const status = await fetchCheckoutStatus(hostedSessionId, anonId)
        state.consecutiveFailures = 0
        setPollTrouble(false)
        if (status.status === 'paid') {
          paid = true
        }
      } catch (err) {
        const httpStatus = err?.status ?? 'unknown'
        if (httpStatus === 429) {
          console.warn(
            `[checkout] checkout-status rate limited (HTTP 429) for hosted session ${hostedSessionId}; retrying.`,
          )
        } else {
          console.warn(
            `[checkout] checkout-status failed (HTTP ${httpStatus}) for hosted session ${hostedSessionId}:`,
            err?.message ?? err,
          )
        }
        state.consecutiveFailures = (state.consecutiveFailures ?? 0) + 1
        if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          setPollTrouble(true)
        }
      }
    }

    if (!paid && creditsToAdd > 0) {
      try {
        const bal = await fetchBillingBalance(anonId)
        state.consecutiveFailures = 0
        setPollTrouble(false)
        if ((bal.balance_credits ?? 0) >= balanceBefore + creditsToAdd) {
          paid = true
        }
      } catch (err) {
        const httpStatus = err?.status ?? 'unknown'
        console.warn(`[checkout] balance poll failed (HTTP ${httpStatus}):`, err?.message ?? err)
        state.consecutiveFailures = (state.consecutiveFailures ?? 0) + 1
        if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          setPollTrouble(true)
        }
      }
    }

    if (paid) {
      completeCheckout()
      return true
    }
    return false
  }, [completeCheckout])

  const checkPaymentStatus = useCallback(async () => {
    setCheckingStatus(true)
    setPollTrouble(false)
    if (pollStateRef.current) {
      pollStateRef.current.consecutiveFailures = 0
    }
    try {
      const paid = await pollPaymentOnce()
      if (paid) setTimedOut(false)
      return paid
    } finally {
      setCheckingStatus(false)
    }
  }, [pollPaymentOnce])

  const schedulePollTick = useCallback(() => {
    const state = pollStateRef.current
    if (!state) return

    const elapsed = Date.now() - (state.startedAt ?? Date.now())
    const interval = elapsed < FAST_POLL_DURATION_MS ? FAST_POLL_MS : SLOW_POLL_MS

    pollRef.current = window.setTimeout(() => {
      void (async () => {
        const done = await pollPaymentOnce()
        if (!pollStateRef.current || done) return
        schedulePollTick()
      })()
    }, interval)
  }, [pollPaymentOnce])

  const startPolling = useCallback(
    (balanceBefore, creditsToAdd, hostedSessionId) => {
      if (!hostedSessionId && (!creditsToAdd || creditsToAdd <= 0)) return

      pollStateRef.current = {
        hostedSessionId: hostedSessionId ?? null,
        balanceBefore,
        creditsToAdd: creditsToAdd ?? 0,
        startedAt: Date.now(),
        consecutiveFailures: 0,
      }
      setWaiting(true)
      setTimedOut(false)
      setPollTrouble(false)

      void pollPaymentOnce().then(done => {
        if (!done && pollStateRef.current) schedulePollTick()
      })

      timeoutRef.current = window.setTimeout(() => {
        setTimedOut(true)
      }, POLL_TIMEOUT_MS)
    },
    [pollPaymentOnce, schedulePollTick],
  )

  const bootstrapCheckout = useCallback(
    async (bootstrapId, options) => {
      const {
        title,
        charge_usd: chargeUsdHint,
        credits_to_add: creditsToAddHint,
        fetchSession,
        fetchPreview,
      } = options

      let publishableKey = stripePublishableKey
      if (!publishableKey) {
        try {
          const packs = await fetchBillingPacks()
          publishableKey = packs.stripe_publishable_key ?? ''
          if (bootstrapId !== bootstrapIdRef.current) return
          setStripePublishableKey(publishableKey)
          if (publishableKey) getStripePromise(publishableKey)
        } catch {
          publishableKey = ''
        }
      }

      try {
        const [balanceResult, embedSession, hostedSession, previewResult] = await Promise.all([
          fetchBillingBalance(getOrCreateAnonId()).catch(() => ({ balance_credits: 0 })),
          fetchSession(true).catch(err => {
            console.warn('Embedded checkout unavailable', err)
            return null
          }),
          fetchSession(false),
          creditsToAddHint != null
            ? Promise.resolve(null)
            : fetchPreview?.().catch(() => null) ?? Promise.resolve(null),
        ])

        if (bootstrapId !== bootstrapIdRef.current) return

        const balanceBefore = balanceResult.balance_credits ?? 0
        const hostedSessionId = hostedSession?.session_id ?? null
        const creditsToAdd =
          hostedSession?.credits_to_add ??
          creditsToAddHint ??
          previewResult?.credits_to_add ??
          null
        const hostedUrl = hostedSession?.url ?? null
        const embedSecret = embedSession?.client_secret ?? null

        if (embedSession?.session_id) {
          console.info('[checkout] embedded session (pay on this device):', embedSession.session_id)
        }
        if (hostedSessionId) {
          console.info('[checkout] hosted session (QR + poll target):', hostedSessionId)
        }
        if (hostedUrl && !hostedSessionId) {
          throw new Error('Hosted checkout URL missing session_id — cannot poll payment status')
        }

        if (!embedSecret && !hostedUrl) {
          throw new Error('Checkout session missing')
        }

        setModal(prev =>
          prev
            ? {
                ...prev,
                title: title ?? prev.title,
                chargeUsd:
                  embedSession?.charge_usd ??
                  hostedSession?.charge_usd ??
                  chargeUsdHint ??
                  prev.chargeUsd,
                clientSecret: embedSecret,
                checkoutUrl: hostedUrl,
                publishableKey: publishableKey,
                creditsToAdd,
                preparing: false,
              }
            : prev,
        )
        setPhoneUrlLoading(false)

        if (hostedSessionId || creditsToAdd) {
          startPolling(balanceBefore, creditsToAdd ?? 0, hostedSessionId)
        }
      } catch (err) {
        if (bootstrapId !== bootstrapIdRef.current) return
        closeModal()
        throw err
      }
    },
    [stripePublishableKey, startPolling, closeModal],
  )

  const presentCheckout = useCallback(
    (options = {}) => {
      const {
        title,
        charge_usd: chargeUsdHint,
        credits_to_add: creditsToAdd,
        onComplete,
        onCancel,
        fetchSession,
        fetchPreview,
      } = options

      if (!fetchSession) throw new Error('fetchSession is required')

      if (!isDesktop) {
        return (async () => {
          const session = await fetchSession(false)
          if (!session?.url) throw new Error('Checkout URL missing')
          window.location.href = session.url
        })()
      }

      onCompleteRef.current = onComplete ?? null
      onCancelRef.current = onCancel ?? null

      const bootstrapId = bootstrapIdRef.current + 1
      bootstrapIdRef.current = bootstrapId

      setWaiting(false)
      setTimedOut(false)
      setPollTrouble(false)
      setPhoneUrlLoading(true)
      setModal({
        title: title ?? 'Complete payment',
        chargeUsd: chargeUsdHint ?? null,
        clientSecret: null,
        checkoutUrl: null,
        publishableKey: stripePublishableKey,
        creditsToAdd: creditsToAdd ?? null,
        preparing: true,
      })

      void bootstrapCheckout(bootstrapId, {
        title,
        charge_usd: chargeUsdHint,
        credits_to_add: creditsToAdd,
        fetchSession,
        fetchPreview,
      }).catch(() => {
        /* closeModal already invoked in bootstrapCheckout */
      })
    },
    [isDesktop, stripePublishableKey, bootstrapCheckout],
  )

  const handleEmbeddedComplete = useCallback(() => {
    if (!modal?.creditsToAdd) {
      completeCheckout()
    }
  }, [modal?.creditsToAdd, completeCheckout])

  useEffect(() => () => clearPolling(), [clearPolling])

  return (
    <CheckoutPayContext.Provider value={{ presentCheckout, closeCheckout: closeModal }}>
      {children}
      <CheckoutPayModal
        open={Boolean(modal)}
        title={modal?.title}
        chargeUsd={modal?.chargeUsd}
        clientSecret={modal?.clientSecret}
        checkoutUrl={modal?.checkoutUrl}
        stripePublishableKey={modal?.publishableKey || stripePublishableKey}
        preparing={modal?.preparing ?? false}
        phoneUrlLoading={phoneUrlLoading}
        waiting={waiting}
        timedOut={timedOut}
        pollTrouble={pollTrouble}
        checkingStatus={checkingStatus}
        onCheckPaymentStatus={checkPaymentStatus}
        onEmbeddedComplete={handleEmbeddedComplete}
        onClose={closeModal}
      />
    </CheckoutPayContext.Provider>
  )
}

export function useCheckoutPay() {
  const ctx = useContext(CheckoutPayContext)
  if (!ctx) {
    throw new Error('useCheckoutPay must be used within CheckoutPayProvider')
  }
  return ctx
}
