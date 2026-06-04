import { useState } from 'react'

import { formatUsd } from '../../services/propertyApi'



function formatCost(api, svc) {

  const parts = []

  if (api > 0) parts.push(`api ${formatUsd(api)}`)

  if (svc > 0) parts.push(`svc ${formatUsd(svc)}`)

  if (parts.length === 0) return 'free'

  return parts.join(' · ')

}



function emptyHint({ address, selectedCount, locationLocked }) {

  if (!address?.trim()) return 'Add a property address to start.'

  if (!locationLocked) return 'Confirm the map pin to get pricing.'

  if (selectedCount === 0) return 'Choose a package or at least one source.'

  return 'Calculating estimate…'

}



export default function LiveReceipt({

  quote,

  loading,

  onGenerate,

  generateDisabled,

  loadingReport,

  address,

  selectedCount = 0,

  locationLocked,

  sticky = false,

}) {

  const [detailsOpen, setDetailsOpen] = useState(false)

  const totals = quote?.totals

  const isFinal = quote?.isFinal || quote?.report_id

  const items = quote?.line_items ?? []

  const hasQuote = Boolean(quote || loading)

  const hint = emptyHint({ address, selectedCount, locationLocked })



  const shellClass = sticky

    ? 'shrink-0 border-t border-panel-border bg-panel-bg shadow-[0_-8px_24px_rgba(0,0,0,0.45)]'

    : 'border-t border-panel-border'



  if (!hasQuote) {

    return (

      <div className={`${shellClass} p-4`}>

        <div className="flex items-start justify-between gap-3">

          <div>

            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Estimate</p>

            <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-faint">{hint}</p>

          </div>

          <button

            type="button"

            disabled

            className="shrink-0 rounded border border-panel-border px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-ink-faint opacity-50"

          >

            Generate

          </button>

        </div>

      </div>

    )

  }



  return (

    <div className={shellClass}>

      <div className="flex items-center gap-3 border-b border-panel-border/60 px-4 py-3">

        <div className="min-w-0 flex-1">

          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">

            {isFinal ? 'Final total' : 'Estimated total'}

          </p>

          <p className="font-display text-lg tabular-nums text-white">

            {loading && !totals ? '…' : formatUsd(totals?.user_price_usd)}

          </p>

        </div>

        {!isFinal ? (

          <button

            type="button"

            disabled={generateDisabled || loadingReport}

            onClick={onGenerate}

            className="shrink-0 rounded border border-command-live/50 bg-command-live/15 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-command-live transition hover:bg-command-live/25 disabled:opacity-40"

          >

            {loadingReport

              ? 'Running…'

              : totals

                ? `Generate — ${formatUsd(totals.user_price_usd)}`

                : 'Generate'}

          </button>

        ) : null}

        {items.length > 0 ? (

          <button

            type="button"

            onClick={() => setDetailsOpen(v => !v)}

            className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-faint hover:text-ink-secondary"

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

                        {item.message ? ` — ${item.message}` : ''}

                      </p>

                    ) : null}

                  </div>

                  <span className="shrink-0 font-mono text-[9px] tabular-nums text-ink-faint">

                    {item.charged === false && item.run_status ? (

                      <span className="line-through">{formatCost(item.api_cost_usd, item.service_cost_usd)}</span>

                    ) : (

                      formatCost(item.api_cost_usd, item.service_cost_usd)

                    )}

                  </span>

                </li>

              ))

            )}

          </ul>



          {totals ? (

            <div className="space-y-1 border-t border-panel-border px-4 py-2 font-mono text-[10px]">

              <div className="flex justify-between text-ink-muted">

                <span>API cost</span>

                <span className="tabular-nums">{formatUsd(totals.api_cost_usd)}</span>

              </div>

              <div className="flex justify-between text-ink-muted">

                <span>Service cost</span>

                <span className="tabular-nums">{formatUsd(totals.service_cost_usd)}</span>

              </div>

              {!isFinal ? (

                <p className="pt-1 font-mono text-[9px] leading-relaxed text-ink-faint">

                  Dry run — wallet billing not enabled

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



      {!detailsOpen && !isFinal && totals ? (

        <p className="px-4 pb-2 font-mono text-[9px] text-ink-faint">

          {selectedCount} sources · dry run pricing

        </p>

      ) : null}

    </div>

  )

}

