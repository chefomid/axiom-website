import { useEffect, useMemo, useRef, useState } from 'react'

import { motion, AnimatePresence } from 'framer-motion'

import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'

import { QRCodeSVG } from 'qrcode.react'

import { formatUsd } from '../../services/propertyApi'
import { STRIPE_EMBEDDED_APPEARANCE } from '../../utils/stripeAppearance'
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
      <CheckoutLoadingStatus label="Loading Stripe checkout" />
      <div className="space-y-3" aria-hidden>
        <div className="checkout-skeleton-block checkout-skeleton-block--light h-12 w-full rounded-md" />
        <div className="flex gap-3">
          <div className="checkout-skeleton-block h-10 flex-1 rounded-md" />
          <div className="checkout-skeleton-block h-10 w-24 rounded-md" />
        </div>
        <div className="checkout-skeleton-block h-11 w-full rounded-md" />
        <div className="checkout-skeleton-block h-10 w-full rounded-md" />
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

  const embeddedOptions = useMemo(
    () => ({
      clientSecret,
      onComplete,
      appearance: STRIPE_EMBEDDED_APPEARANCE,
    }),
    [clientSecret, onComplete],
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
    <div className="relative min-h-[380px]">
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

      <EmbeddedCheckoutProvider stripe={stripePromise} options={embeddedOptions}>
        <div
          ref={containerRef}
          className={`min-h-[380px] overflow-hidden rounded-lg border border-panel-border bg-white transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <EmbeddedCheckout />
        </div>
      </EmbeddedCheckoutProvider>
    </div>
  )
}

function PhonePaySection({ checkoutUrl, phoneUrlLoading, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  if (!checkoutUrl && phoneUrlLoading) {
    return (
      <div className="mt-6 border-t border-panel-border pt-6">
        <CheckoutQrSkeleton />
      </div>
    )
  }

  if (!checkoutUrl) return null

  return (
    <div className="mt-6 border-t border-panel-border pt-5">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-panel-border bg-panel-surface/20 px-4 py-3 text-left transition-colors hover:border-[#333] hover:bg-panel-surface/40"
        aria-expanded={open}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-secondary">
          Pay on your phone
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="phone-pay-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="pt-4 text-center">
              <div className="mx-auto flex w-fit items-center justify-center rounded-xl border border-panel-border bg-white p-3">
                <QRCodeSVG value={checkoutUrl} size={160} level="M" includeMargin={false} />
              </div>
              <p className="mt-3 font-sans text-sm leading-relaxed text-ink-secondary">
                Scan with your phone&apos;s camera. Apple Pay and saved cards work on mobile.
              </p>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex font-mono text-[10px] uppercase tracking-[0.14em] text-command-live underline decoration-command-live/35 underline-offset-2 hover:text-white"
              >
                Open checkout on phone
              </a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
      <CheckoutFormSkeleton />
      <div className="mt-6 border-t border-panel-border pt-5">
        <div className="mx-auto h-4 w-40 rounded checkout-skeleton-block" aria-hidden />
        <div className="mt-4 flex justify-center">
          <CheckoutQrSkeleton />
        </div>
      </div>
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
      {embeddedReady ? (
        <>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
            Pay on this device
          </p>
          <EmbeddedCheckoutPanel
            clientSecret={clientSecret}
            stripePublishableKey={stripePublishableKey}
            onComplete={onEmbeddedComplete}
          />
          <p className="mt-3 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M6 1L1 3.5v2.5c0 2.75 2.15 5.32 5 5.95 2.85-.63 5-3.2 5-5.95V3.5L6 1z"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            Secured by Stripe
          </p>
          <PhonePaySection checkoutUrl={checkoutUrl} phoneUrlLoading={phoneUrlLoading} defaultOpen={false} />
        </>
      ) : checkoutUrl ? (
        <>
          <PhonePaySection checkoutUrl={checkoutUrl} phoneUrlLoading={phoneUrlLoading} defaultOpen />
          <div className="mt-6 rounded-lg border border-panel-border bg-panel-surface/30 px-4 py-5 text-center">
            <p className="font-sans text-sm leading-relaxed text-ink-secondary">
              In-page card entry requires your Stripe publishable key on the server. Use the QR code
              above or open checkout in a new tab.
            </p>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="workflow-footer-cta mt-4 inline-flex !h-auto min-h-[44px] w-full items-center justify-center py-3.5 !text-sm no-underline"
            >
              Open Stripe checkout
            </a>
          </div>
        </>
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
  pollTrouble = false,
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
            className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-xl border border-panel-border bg-panel-bg shadow-2xl will-change-transform sm:rounded-xl"
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

            <div className="min-h-[420px] flex-1 overflow-y-auto px-6 py-6">
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

              {pollTrouble && !timedOut ? (
                <div className="mt-4 space-y-3 text-center">
                  <p className="font-mono text-[12px] leading-relaxed text-command-watch">
                    Having trouble confirming payment. You can check again or keep waiting.
                  </p>
                  {onCheckPaymentStatus ? (
                    <button
                      type="button"
                      onClick={() => void onCheckPaymentStatus()}
                      disabled={checkingStatus}
                      className="workflow-footer-cta inline-flex !h-auto min-h-[40px] items-center justify-center px-4 py-2.5 !text-[11px] tracking-[0.12em]"
                    >
                      {checkingStatus ? 'Checking…' : 'Check again'}
                    </button>
                  ) : null}
                </div>
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
