import { Link } from 'react-router-dom'

import { CONTACT_EMAIL } from '../../constants/site'
import { formatUsd } from '../../services/propertyApi'

function PostPaymentShell({ children, title = 'Property Intelligence' }) {
  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black font-sans text-ink-primary">
      <header className="shrink-0 border-b border-panel-border bg-[#060606]/95 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">Property Intelligence</p>
            <p className="font-display truncate text-sm font-semibold text-white">{title}</p>
          </div>
        </div>
      </header>
      <main className="sleek-scrollbar flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  )
}

function CardRefundLine({ paymentSummary }) {
  if (!paymentSummary?.last4) return null
  const brand = paymentSummary.brand || 'Card'
  return (
    <p className="mt-4 font-sans text-sm leading-relaxed text-ink-secondary">
      Your refund will be sent to your{' '}
      <span className="text-white">{brand}</span> card ending in{' '}
      <span className="font-mono text-white">•••• {paymentSummary.last4}</span>.
    </p>
  )
}

export default function PostPaymentOverlay({
  phase,
  context,
  errorMessage,
  refundResult,
  showRefundEligible,
  onRequestRefund,
  onDismiss,
}) {
  if (phase === 'confirming') {
    return (
      <PostPaymentShell title="Payment confirmed">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-command-live/40 bg-command-live/10">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path
                d="M6 11.5l3.2 3.2L16 7.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-command-live"
              />
            </svg>
          </div>
          <p className="font-display text-xl font-semibold text-white">Payment confirmed</p>
          <p className="mt-2 font-sans text-sm text-ink-secondary">Starting your report…</p>
        </div>
      </PostPaymentShell>
    )
  }

  if (phase === 'generating') {
    return (
      <PostPaymentShell title="Building report">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <span className="street-view-spinner mb-4 h-5 w-5" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">Generating report</p>
          <p className="mt-2 font-display text-lg font-semibold text-white">Building your report…</p>
          <p className="mt-2 max-w-sm font-sans text-sm leading-relaxed text-ink-secondary">
            This can take a minute while we gather property intelligence.
          </p>
        </div>
      </PostPaymentShell>
    )
  }

  if (phase === 'error') {
    return (
      <PostPaymentShell title="Report unavailable">
        <div className="mx-auto mt-10 max-w-md px-4 pb-10">
          <div className="rounded-lg border border-panel-border bg-panel-surface/30 px-5 py-6 text-center">
            <p className="font-display text-xl font-semibold text-white">We couldn&apos;t finish your report.</p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-ink-secondary">
              Your payment was received, but report generation failed.
              {errorMessage ? ` ${errorMessage}` : ''}
            </p>
            <CardRefundLine paymentSummary={context?.paymentSummary} />
            <p className="mt-4 font-sans text-sm leading-relaxed text-ink-secondary">
              Need help?{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-white underline decoration-[#444] underline-offset-2 transition-colors hover:decoration-white"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {showRefundEligible ? (
                <button
                  type="button"
                  onClick={onRequestRefund}
                  className="inline-flex min-h-[44px] items-center justify-center rounded border border-[#5a2a2a] bg-[#2a1212]/60 px-5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#ffb4b4] transition-colors hover:border-[#844] hover:text-white"
                >
                  Request refund
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex min-h-[44px] items-center justify-center rounded border border-panel-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:border-[#444] hover:text-white"
              >
                Back to overview
              </button>
            </div>
          </div>
        </div>
      </PostPaymentShell>
    )
  }

  if (phase === 'refunded') {
    const brand = refundResult?.brand || context?.paymentSummary?.brand || 'Card'
    const last4 = refundResult?.last4 || context?.paymentSummary?.last4 || ''
    const amountUsd = refundResult?.amount_usd ?? context?.paymentSummary?.amountUsd
    const refundPrefix = (refundResult?.refund_id || '').slice(0, 12)

    return (
      <PostPaymentShell title="Refund submitted">
        <div className="mx-auto mt-10 max-w-md px-4 pb-10 text-center">
          <p className="font-display text-2xl font-semibold text-white">Refund submitted</p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-ink-secondary">
            {formatUsd(amountUsd)} will be returned to your {brand} card ending in •••• {last4}.
          </p>
          {refundPrefix ? (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Refund reference: {refundPrefix}…
            </p>
          ) : null}
          <p className="mt-4 font-sans text-xs leading-relaxed text-ink-faint">
            Refunds typically appear on your statement within 5–10 business days.
          </p>
          <Link
            to="/property-intelligence"
            onClick={onDismiss}
            className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded border border-panel-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary no-underline transition-colors hover:border-[#444] hover:text-white"
          >
            Back to overview
          </Link>
        </div>
      </PostPaymentShell>
    )
  }

  return null
}
