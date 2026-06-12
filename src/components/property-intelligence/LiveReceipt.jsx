import { useState } from 'react'

import { formatUsd, formatLineItemPrice } from '../../services/propertyApi'
import { emptyHint } from './workflowReceiptUtils'
import WorkflowEstimate from './WorkflowEstimate'
import WorkflowGenerateButton from './WorkflowGenerateButton'

export default function LiveReceipt({
  quote,
  loading,
  onGenerate,
  generateDisabled,
  loadingReport,
  address,
  selectedCount = 0,
  locationLocked,
  quoteError,
  apiOnline,
  sticky = false,
  hasReport = false,
  generateBlockReason = null,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const totals = quote?.totals
  const isFinal = hasReport
  const showGenerate = !hasReport
  const items = quote?.line_items ?? []
  const hasQuote = Boolean(quote || loading)
  const hint = emptyHint({ address, selectedCount, locationLocked, loading, quoteError, apiOnline })
  const blockReason = generateBlockReason ?? hint

  const shellClass = sticky
    ? 'shrink-0 border-t border-white/10 bg-panel-surface/80 backdrop-blur-sm'
    : 'border-t border-panel-border'

  if (!hasQuote) {
    return (
      <div className={`${shellClass} px-4 py-4`}>
        <div className="flex items-center justify-between gap-4">
          <WorkflowEstimate
            quote={quote}
            loading={loading}
            address={address}
            selectedCount={selectedCount}
            locationLocked={locationLocked}
            quoteError={quoteError}
            apiOnline={apiOnline}
            hasReport={hasReport}
          />
          <WorkflowGenerateButton
            quote={quote}
            loading={loading}
            onGenerate={onGenerate}
            generateDisabled
            loadingReport={loadingReport}
            address={address}
            selectedCount={selectedCount}
            locationLocked={locationLocked}
            quoteError={quoteError}
            apiOnline={apiOnline}
            hasReport={hasReport}
            generateBlockReason={blockReason}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium text-ink-secondary">
            {isFinal ? 'Final total' : 'Estimated total'}
          </p>
          <p className="font-display text-xl tabular-nums text-white">
            {loading && !totals ? '…' : formatUsd(totals?.user_price_usd)}
          </p>
        </div>
        {showGenerate ? (
          <WorkflowGenerateButton
            quote={quote}
            loading={loading}
            onGenerate={onGenerate}
            generateDisabled={generateDisabled}
            loadingReport={loadingReport}
            address={address}
            selectedCount={selectedCount}
            locationLocked={locationLocked}
            quoteError={quoteError}
            apiOnline={apiOnline}
            hasReport={hasReport}
            generateBlockReason={generateBlockReason}
          />
        ) : null}
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => setDetailsOpen(v => !v)}
            className="shrink-0 font-sans text-xs text-ink-faint hover:text-ink-secondary"
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? 'Hide' : 'Details'}
          </button>
        ) : null}
      </div>

      {detailsOpen ? (
        <>
          {quote?.report_id ? (
            <p className="border-b border-panel-border/60 px-4 py-2 font-mono text-[10px] tabular-nums text-ink-secondary">
              {quote.report_id}
            </p>
          ) : null}
          <ul className="max-h-40 overflow-y-auto sleek-scrollbar divide-y divide-panel-border/60">
            {loading ? (
              <li className="px-4 py-3 font-mono text-[10px] text-ink-muted">Calculating…</li>
            ) : (
              items.map(item => (
                <li key={item.source_id} className="flex items-start justify-between gap-2 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] text-white">{item.label}</p>
                    {item.run_status ? (
                      <p
                        className={`font-mono text-[9px] uppercase ${
                          item.run_status === 'success'
                            ? 'text-command-stable'
                            : item.run_status === 'failed'
                              ? 'text-command-critical'
                              : 'text-ink-faint'
                        }`}
                      >
                        {item.run_status}
                        {item.message ? `, ${item.message}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-[9px] tabular-nums text-ink-faint">
                    {item.charged === false && item.run_status ? (
                      <span className="line-through">{formatLineItemPrice(item)}</span>
                    ) : (
                      formatLineItemPrice(item)
                    )}
                  </span>
                </li>
              ))
            )}
          </ul>
          {totals ? (
            <div className="space-y-1 border-t border-panel-border px-4 py-2 font-mono text-[10px]">
              <div className="flex justify-between text-ink-muted">
                <span>Loaded cost</span>
                <span className="tabular-nums">{formatUsd(totals.loaded_cost_usd)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Margin</span>
                <span className="tabular-nums">×{totals.margin_multiplier ?? 2.5}</span>
              </div>
              <div className="flex justify-between text-white">
                <span>User price</span>
                <span className="tabular-nums">{formatUsd(totals.user_price_usd)}</span>
              </div>
              {!isFinal ? (
                <p className="pt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
                  Dry run, wallet billing not enabled
                </p>
              ) : null}
            </div>
          ) : null}
          {quote?.warnings?.length > 0 ? (
            <div className="border-t border-panel-border px-4 py-2">
              {quote.warnings.map((w, i) => (
                <p key={i} className="font-mono text-[9px] leading-relaxed text-command-watch">
                  {w}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {!detailsOpen && showGenerate && totals ? (
        <p
          className={`px-4 pb-3 font-sans text-xs leading-relaxed ${generateDisabled && blockReason ? 'text-command-watch' : 'text-ink-muted'}`}
        >
          {generateDisabled && blockReason ? blockReason : `${selectedCount} sources · dry run pricing`}
        </p>
      ) : null}
    </div>
  )
}
