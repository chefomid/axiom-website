import { formatUsd } from '../../services/propertyApi'

export default function RefundConfirmModal({
  open,
  loading,
  paymentSummary,
  onCancel,
  onConfirm,
}) {
  if (!open) return null

  const brand = paymentSummary?.brand || 'Card'
  const last4 = paymentSummary?.last4 || '••••'
  const amountUsd = paymentSummary?.amountUsd

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-confirm-title"
        className="w-full max-w-md rounded-lg border border-panel-border bg-[#0a0a0a] px-5 py-6 shadow-2xl"
      >
        <p id="refund-confirm-title" className="font-display text-lg font-semibold text-white">
          Confirm refund
        </p>
        <p className="mt-3 font-sans text-sm leading-relaxed text-ink-secondary">
          Refund {formatUsd(amountUsd)} to your{' '}
          <span className="text-white">{brand}</span> card ending in{' '}
          <span className="font-mono text-white">•••• {last4}</span>?
        </p>
        <p className="mt-3 font-sans text-sm leading-relaxed text-ink-muted">
          This will cancel your report purchase and remove the credits from your wallet.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center justify-center rounded border border-panel-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:border-[#444] hover:text-white disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center justify-center rounded border border-[#5a2a2a] bg-[#2a1212]/60 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[#ffb4b4] transition-colors hover:border-[#844] hover:text-white disabled:opacity-60"
          >
            {loading ? 'Processing…' : 'Confirm refund'}
          </button>
        </div>
      </div>
    </div>
  )
}
