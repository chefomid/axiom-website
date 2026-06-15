import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import CheckoutPayModal from '../components/property-intelligence/CheckoutPayModal'
import { useIsLgUp } from './useMediaQuery'
import { fetchBillingBalance, fetchBillingPacks } from '../services/propertyApi'
import { getOrCreateAnonId } from '../utils/anonId'
import { getStripePromise } from '../utils/stripeClient'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 15 * 60 * 1000

const CheckoutPayContext = createContext(null)

export function CheckoutPayProvider({ children }) {
  const isDesktop = useIsLgUp()
  const [modal, setModal] = useState(null)
  const [waiting, setWaiting] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [stripePublishableKey, setStripePublishableKey] = useState('')
  const [phoneUrlLoading, setPhoneUrlLoading] = useState(false)
  const pollRef = useRef(null)
  const timeoutRef = useRef(null)
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
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const closeModal = useCallback(() => {
    bootstrapIdRef.current += 1
    clearPolling()
    onCancelRef.current?.()
    setModal(null)
    setWaiting(false)
    setTimedOut(false)
    setPhoneUrlLoading(false)
    onCompleteRef.current = null
    onCancelRef.current = null
  }, [clearPolling])

  const completeCheckout = useCallback(() => {
    const onComplete = onCompleteRef.current
    bootstrapIdRef.current += 1
    clearPolling()
    setModal(null)
    setWaiting(false)
    setTimedOut(false)
    setPhoneUrlLoading(false)
    onCompleteRef.current = null
    onCancelRef.current = null
    window.dispatchEvent(new Event('axiom:billing-refresh'))
    onComplete?.()
  }, [clearPolling])

  const startPolling = useCallback(
    (balanceBefore, creditsToAdd) => {
      if (!creditsToAdd || creditsToAdd <= 0) return
      const anonId = getOrCreateAnonId()
      const targetBalance = balanceBefore + creditsToAdd
      setWaiting(true)
      setTimedOut(false)

      pollRef.current = window.setInterval(async () => {
        try {
          const bal = await fetchBillingBalance(anonId)
          if ((bal.balance_credits ?? 0) >= targetBalance) {
            completeCheckout()
          }
        } catch {
          /* keep polling */
        }
      }, POLL_INTERVAL_MS)

      timeoutRef.current = window.setTimeout(() => {
        setTimedOut(true)
      }, POLL_TIMEOUT_MS)
    },
    [completeCheckout],
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
        const creditsToAdd = creditsToAddHint ?? previewResult?.credits_to_add ?? null
        const hostedUrl = hostedSession?.url ?? null
        const embedSecret = embedSession?.client_secret ?? null

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

        if (creditsToAdd) {
          startPolling(balanceBefore, creditsToAdd)
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
