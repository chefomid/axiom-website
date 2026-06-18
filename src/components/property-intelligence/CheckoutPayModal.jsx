import { useEffect, useMemo, useRef, useState } from 'react'

import { motion, AnimatePresence } from 'framer-motion'

import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'

import { QRCodeSVG } from 'qrcode.react'

import { formatUsd } from '../../services/propertyApi'

import { getStripePromise } from '../../utils/stripeClient'

import { WORKFLOW_CTL } from './workflowControls'

const EASE_OUT = [0.32, 0.72, 0, 1]
const FADE = { duration: 0.18, ease: EASE_OUT }
const SLIDE = { duration: 0.24, ease: EASE_OUT }
const QR_SKELETON_CELLS = Array.from({ length: 49 }, (_, index) => index)

function CheckoutLoadingStatus({ label = 'Preparing secure checkout' }) {
  return (
    <p className="mb-5 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
      <span className="street-view-spinner h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{label}</span>
      <span className="eq-loading-dots inline-flex w-[1.1rem]" aria-hidden>
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </p>
  )
}

function CheckoutQrSkeleton() {
  return (
    <div className="mx-auto flex w-fit items-center justify-center rounded-xl border border-panel-border bg-white p-3">
      <div className="relative h-[160px] w-[160px] overflow-hidden rounded-lg bg-[#ececec]">
        <div className="checkout-skeleton-qr-grid h-full w-full" aria-hidden>
          {QR_SKELETON_CELLS.map(index => (
            <div key={index} className="checkout-skeleton-qr-cell" />
          ))}
        </div>
        <div className="checkout-skeleton-block checkout-skeleton-block--light absolute inset-0 opacity-40" aria-hidden />
      </div>
    </div>
  )
}

function CheckoutFormSkeleton() {
  return (
    <div
      className="flex flex-col rounded-lg border border-panel-border bg-panel-surface/30 px-4 py-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading payment form"
    >
      <CheckoutLoadingStatus label="Loading payment form" />
      <div className="space-y-3" aria-hidden>
        <div className="checkout-skeleton-block checkout-skeleton-block--light h-12 w-full rounded-md" />
        <div className="flex gap-3">
          <div className="checkout-skeleton-block h-10 flex-1 rounded-md" />
          <div className="checkout-skeleton-block h-10 w-24 rounded-md" />
        </div>
        <div className="checkout-skeleton-block h-11 w-full rounded-md" />
      </div>
    </div>
  )
}

function EmbeddedCheckoutPanel({ clientSecret, stripePublishableKey, onComplete }) {
  const containerRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const stripePromise = useMemo(
    () => getStripePromise(stripePublishableKey),
    [stripePublishableKey],
  )

  useEffect(() => {
    setLoaded(false)
  }, [clientSecret])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    let iframeCleanup = () => {}
    let observer = null

    const markLoaded = () => {
      window.setTimeout(() => setLoaded(true), 150)
    }

    const attachIframeListener = () => {
      const iframe = root.querySelector('iframe')
      if (!iframe) return false
      const onLoad = () => markLoaded()
      iframe.addEventListener('load', onLoad)
      iframeCleanup = () => iframe.removeEventListener('load', onLoad)
      return true
    }

    if (!attachIframeListener()) {
      observer = new MutationObserver(() => {
        if (attachIframeListener()) observer?.disconnect()
      })
      observer.observe(root, { childList: true, subtree: true })
    }

    const fallback = window.setTimeout(markLoaded, 8000)

    return () => {
      observer?.disconnect()
      iframeCleanup()
      window.clearTimeout(fallback)
    }
  }, [clientSecret])

  if (!clientSecret || !stripePromise) return null

  return (
    <div className="relative min-h-[320px]">
      <AnimatePresence>
        {!loaded ? (
          <motion.div
            key="checkout-form-skeleton"
            className="absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
          >
            <CheckoutFormSkeleton />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          clientSecret,
          onComplete,
        }}
      >
        <div
          ref={containerRef}
          className={`min-h-[320px] overflow-hidden rounded-lg border border-panel-border bg-white transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <EmbeddedCheckout />
        </div>
      </EmbeddedCheckoutProvider>
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div
      className="flex flex-col"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Preparing secure checkout"
    >
      <CheckoutLoadingStatus />
      <CheckoutQrSkeleton />
      <div className="mx-auto mt-4 h-4 w-56 rounded checkout-skeleton-block" aria-hidden />
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-panel-border" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">or on this device</span>
        <div className="h-px flex-1 bg-panel-border" />
      </div>
      <CheckoutFormSkeleton />
    </div>
  )
}

function CheckoutContent({
  embeddedReady,
  phoneUrlLoading,
  checkoutUrl,
  clientSecret,
  stripePublishableKey,
  onEmbeddedComplete,
}) {
  return (
    <motion.div
      key="checkout-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={FADE}
      className="flex flex-col"
    >
      {phoneUrlLoading || !checkoutUrl ? (
        <CheckoutQrSkeleton />
      ) : (
        <div className="mx-auto flex w-fit items-center justify-center rounded-xl border border-panel-border bg-white p-3">
          <QRCodeSVG value={checkoutUrl} size={160} level="M" includeMargin={false} />
        </div>
      )}

      <p className="mt-3 text-center font-sans text-base leading-relaxed text-ink-secondary">
        Scan with your phone&apos;s camera to pay on your phone.
      </p>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-panel-border" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">or on this device</span>
        <div className="h-px flex-1 bg-panel-border" />
      </div>

      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
        Pay with card
      </p>

      {embeddedReady ? (
        <EmbeddedCheckoutPanel
          clientSecret={clientSecret}
          stripePublishableKey={stripePublishableKey}
          onComplete={onEmbeddedComplete}
        />
      ) : checkoutUrl ? (
        <div className="rounded-lg border border-panel-border bg-panel-surface/30 px-4 py-5 text-center">
          <p className="font-sans text-sm leading-relaxed text-ink-secondary">
            Card entry in this window needs your Stripe publishable key on the server. For now, scan the QR
            above or open checkout in a new tab.
          </p>
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="workflow-footer-cta mt-4 inline-flex !h-auto min-h-[44px] w-full items-center justify-center py-3.5 !text-sm no-underline"
          >
            Open card checkout
          </a>
        </div>
      ) : (
        <CheckoutFormSkeleton />
      )}
    </motion.div>
  )
}

export default function CheckoutPayModal({
  open,
  title,
  chargeUsd,
  clientSecret,
  checkoutUrl,
  stripePublishableKey,
  preparing = false,
  phoneUrlLoading = false,
  waiting = false,
  timedOut = false,
  checkingStatus = false,
  onCheckPaymentStatus,
  onEmbeddedComplete,
  onClose,
}) {
  const embeddedReady = Boolean(clientSecret && stripePublishableKey)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-pay-title"
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-panel-border bg-panel-bg shadow-2xl will-change-transform sm:rounded-xl"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={SLIDE}
            onClick={event => event.stopPropagation()}
          >
            <div className="shrink-0 border-b border-panel-border px-6 py-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">Secure checkout</p>
              <h2 id="checkout-pay-title" className="font-display mt-1.5 text-xl font-semibold text-white">
                {title ?? 'Complete payment'}
              </h2>
              {chargeUsd != null ? (
                <p className="mt-1.5 font-display text-3xl tabular-nums text-command-live">
                  {formatUsd(chargeUsd)}
                </p>
              ) : (
                <div className="mt-2 h-8 w-28 rounded checkout-skeleton-block" aria-hidden />
              )}
            </div>

            <div className="min-h-[380px] flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait">
                {preparing ? (
                  <motion.div
                    key="preparing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={FADE}
                  >
                    <CheckoutSkeleton />
                  </motion.div>
                ) : (
                  <CheckoutContent
                    embeddedReady={embeddedReady}
                    phoneUrlLoading={phoneUrlLoading}
                    checkoutUrl={checkoutUrl}
                    clientSecret={clientSecret}
                    stripePublishableKey={stripePublishableKey}
                    onEmbeddedComplete={onEmbeddedComplete}
                  />
                )}
              </AnimatePresence>

              {waiting && !preparing ? (
                <motion.div
                  className="mt-4 flex items-center justify-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={FADE}
                >
                  <span className="street-view-spinner h-3.5 w-3.5 shrink-0" aria-hidden />
                  <p className="font-mono text-[12px] text-ink-secondary">Waiting for payment…</p>
                </motion.div>
              ) : null}

              {timedOut ? (
                <div className="mt-4 space-y-3 text-center">
                  <p className="font-mono text-[12px] leading-relaxed text-command-watch">
                    Payment not detected yet. You can check again or cancel and retry.
                  </p>
                  {onCheckPaymentStatus ? (
                    <button
                      type="button"
                      onClick={() => void onCheckPaymentStatus()}
                      disabled={checkingStatus}
                      className="workflow-footer-cta inline-flex !h-auto min-h-[40px] items-center justify-center px-4 py-2.5 !text-[11px] tracking-[0.12em]"
                    >
                      {checkingStatus ? 'Checking…' : 'Check payment status'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-panel-border px-6 py-5">
              <button
                type="button"
                onClick={onClose}
                className={`${WORKFLOW_CTL} w-full !h-11 border-panel-border bg-panel-surface/40 text-[11px] tracking-[0.14em] text-ink-secondary hover:border-[#333] hover:bg-panel-surface/50 hover:text-white`}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
