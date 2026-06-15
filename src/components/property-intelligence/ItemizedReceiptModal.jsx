import { motion, AnimatePresence } from 'framer-motion'
import { formatUsd } from '../../services/propertyApi'

function ReceiptRow({ row }) {
  if (row.kind === 'section') {
    return (
      <li className="pt-2 first:pt-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">{row.label}</p>
      </li>
    )
  }

  const amountClass =
    row.kind === 'discount'
      ? 'text-command-stable'
      : row.kind === 'adjustment'
        ? 'text-ink-secondary'
        : 'text-ink-secondary'

  return (
    <li className="flex items-start justify-between gap-3 py-1.5">
      <span className="min-w-0 flex-1 font-mono text-[10px] leading-snug text-ink-secondary">{row.label}</span>
      <span className={`shrink-0 font-mono text-[10px] tabular-nums ${amountClass}`}>
        {row.amount < 0 ? `-${formatUsd(Math.abs(row.amount))}` : formatUsd(row.amount)}
      </span>
    </li>
  )
}

export default function ItemizedReceiptModal({ open, onClose, receipt, loading }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[210] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="itemized-receipt-title"
            className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border border-panel-border bg-panel-bg shadow-2xl sm:rounded-xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            onClick={event => event.stopPropagation()}
          >
            <div className="border-b border-panel-border px-5 py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Pricing summary</p>
              <h2 id="itemized-receipt-title" className="font-display mt-1 text-lg font-semibold text-white">
                {receipt?.title ?? 'Itemized receipt'}
              </h2>
            </div>

            <div className="sleek-scrollbar flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <p className="font-mono text-[10px] text-ink-muted">Calculating…</p>
              ) : receipt ? (
                <>
                  <ul className="divide-y divide-panel-border/40">
                    {receipt.lines.map(row => (
                      <ReceiptRow key={row.key} row={row} />
                    ))}
                  </ul>

                  {receipt.locationLines?.length ? (
                    <div className="mt-4 border-t border-panel-border/60 pt-3">
                      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
                        By location
                      </p>
                      <ul className="max-h-40 space-y-1 overflow-y-auto">
                        {receipt.locationLines.map(row => (
                          <li
                            key={row.key}
                            className="flex items-start justify-between gap-2 font-mono text-[9px] text-ink-faint"
                          >
                            <span className="min-w-0 truncate">{row.label}</span>
                            <span className="shrink-0 tabular-nums">{formatUsd(row.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between border-t border-panel-border pt-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white">
                      {receipt.totalLabel}
                    </span>
                    <span className="font-display text-lg tabular-nums text-white">
                      {formatUsd(receipt.totalUsd)}
                    </span>
                  </div>

                  {receipt.footnote ? (
                    <p className="mt-3 font-mono text-[9px] leading-relaxed text-ink-faint">{receipt.footnote}</p>
                  ) : null}
                </>
              ) : (
                <p className="font-mono text-[10px] text-ink-muted">No pricing available yet.</p>
              )}
            </div>

            <div className="flex justify-end border-t border-panel-border px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted hover:text-white"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
