import { useState } from 'react'

import { formatUsd, formatLineItemPrice } from '../../services/propertyApi'
import { receiptAmountClass, platformServiceFeeUsd, licensedReceiptLineItems, licensedReceiptLineAmount } from './workflowReceiptUtils'

export default function WorkflowEstimate({
  quote,
  loading,
  hasReport = false,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const totals = quote?.totals
  const isFinal = hasReport
  const items = quote?.line_items ?? []
  const hasQuote = Boolean(quote || loading)

  if (!hasQuote) {
    return (
      <div className="inline-flex h-8 shrink-0 items-center rounded-md border border-panel-border/60 bg-panel-surface/20 px-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
          Estimate
        </span>
      </div>
    )
  }

  return (
    <div className="relative min-w-0">
      <div className="inline-flex h-8 items-center gap-2 rounded-md border border-panel-border/60 bg-panel-surface/20 px-3">
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
          {isFinal ? 'Final' : 'Estimate'}
        </span>
        <span className={`font-mono text-[10px] font-medium tabular-nums ${receiptAmountClass(totals?.user_price_usd)}`}>
          {loading && !totals ? '…' : formatUsd(totals?.user_price_usd)}
        </span>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => setDetailsOpen(v => !v)}
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink-secondary"
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? 'Hide' : 'Details'}
          </button>
        ) : null}
      </div>

      {detailsOpen ? (
        <div className="workflow-hud-banner__sources-popover left-0 right-auto mt-1 w-72">
          {quote?.report_id ? (
            <p className="border-b border-panel-border/60 px-3 py-2 font-mono text-[9px] tabular-nums text-ink-secondary">
              {quote.report_id}
            </p>
          ) : null}
          <ul className="max-h-48 overflow-y-auto sleek-scrollbar divide-y divide-panel-border/60">
            {loading ? (
              <li className="px-3 py-2 font-mono text-[9px] text-ink-muted">Calculating…</li>
            ) : (
              items.map(item => (
                <li key={item.source_id} className="flex items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9px] text-white">{item.label}</p>
                    {item.run_status ? (
                      <p
                        className={`font-mono text-[8px] uppercase ${
                          item.run_status === 'success'
                            ? 'text-command-stable'
                            : item.run_status === 'failed'
                              ? 'text-command-critical'
                              : 'text-ink-faint'
                        }`}
                      >
                        {item.run_status}
                      </p>
                    ) : null}
                  </div>
                  <span className={`shrink-0 font-mono text-[8px] tabular-nums ${receiptAmountClass(item.user_price_usd ?? 0)}`}>
                    {formatLineItemPrice(item)}
                  </span>
                </li>
              ))
            )}
          </ul>
          {totals ? (
            <div className="space-y-0.5 border-t border-panel-border px-3 py-2 font-mono text-[9px]">
              {totals.platform_service_fee_usd != null ? (
                <>
                  <div className="flex justify-between text-ink-muted">
                    <span>Public feeds (vendor)</span>
                    <span className={`tabular-nums ${receiptAmountClass(0)}`}>{formatUsd(0)}</span>
                  </div>
                  {licensedReceiptLineItems(quote).map(item => (
                    <div key={item.source_id} className="flex justify-between text-ink-muted">
                      <span className="min-w-0 truncate pr-2">{item.label}</span>
                      <span className={`shrink-0 tabular-nums ${receiptAmountClass(licensedReceiptLineAmount(item))}`}>
                        {formatUsd(licensedReceiptLineAmount(item))}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-ink-muted">
                    <span>Aggregation service</span>
                    <span className={`tabular-nums ${receiptAmountClass(platformServiceFeeUsd(totals))}`}>
                      {formatUsd(platformServiceFeeUsd(totals))}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-ink-muted">
                  <span>Loaded</span>
                  <span className="tabular-nums">{formatUsd(totals.loaded_cost_usd)}</span>
                </div>
              )}
              <div className="flex justify-between text-white">
                <span>Total</span>
                <span className={`tabular-nums ${receiptAmountClass(totals.user_price_usd)}`}>
                  {formatUsd(totals.user_price_usd)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
