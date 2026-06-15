import { WORKFLOW_CTL, WORKFLOW_CTL_NEUTRAL } from './workflowControls'



export default function BatchQuotePanel({

  batchQuote,

  scheduleRows = [],

  loadingQuote = false,

  onOpenSchedule,

  onPreviewLocation,

}) {

  const queuedCount = scheduleRows.length



  if (!batchQuote && !queuedCount) {

    return (

      <div className="rounded border border-dashed border-panel-border bg-panel-surface/20 px-3 py-4 text-center">

        <p className="font-mono text-[10px] text-ink-muted">No schedule loaded.</p>

        <button

          type="button"

          onClick={onOpenSchedule}

          className={`${WORKFLOW_CTL} ${WORKFLOW_CTL_NEUTRAL} mt-3 w-full`}

        >

          Open schedule upload

        </button>

      </div>

    )

  }



  if (!batchQuote) {

    return (

      <div className="space-y-3">

        <div className="flex items-center justify-between gap-2">

          <p className="font-mono text-[10px] text-ink-secondary">

            {queuedCount} location{queuedCount === 1 ? '' : 's'} queued

          </p>

          <button

            type="button"

            onClick={onOpenSchedule}

            className="font-mono text-[9px] uppercase tracking-wider text-command-live hover:underline"

          >

            Edit schedule

          </button>

        </div>

        <ul className="max-h-36 space-y-1 overflow-y-auto rounded border border-panel-border bg-black/30 p-2">

          {scheduleRows.map(row => (

            <li

              key={`${row.rowIndex}-${row.address}`}

              className="rounded px-2 py-1.5 font-mono text-[9px] text-ink-secondary"

            >

              <span className="block truncate">{row.address}</span>

            </li>

          ))}

        </ul>

        <p className="font-mono text-[9px] leading-relaxed text-ink-faint">

          Choose a package to validate addresses and see pricing.

        </p>

      </div>

    )

  }



  const valid = batchQuote.locations?.filter(l => l.status === 'valid') ?? []

  const invalid = batchQuote.locations?.filter(l => l.status === 'invalid') ?? []



  return (

    <div className="space-y-3">

      <div className="flex items-center justify-between gap-2">

        <p className="font-mono text-[10px] text-ink-secondary">

          {loadingQuote ? 'Validating…' : `${valid.length} valid · ${invalid.length} invalid`}

        </p>

        <button

          type="button"

          onClick={onOpenSchedule}

          className="font-mono text-[9px] uppercase tracking-wider text-command-live hover:underline"

        >

          Edit schedule

        </button>

      </div>



      <ul className="max-h-36 space-y-1 overflow-y-auto rounded border border-panel-border bg-black/30 p-2">

        {valid.map(loc => (

          <li key={loc.row_index}>

            <button

              type="button"

              onClick={() => onPreviewLocation?.(loc)}

              className="w-full rounded px-2 py-1.5 text-left font-mono text-[9px] text-ink-secondary hover:bg-command-live/10 hover:text-white"

            >

              <span className="block truncate">{loc.display_name ?? loc.address_input}</span>

            </button>

          </li>

        ))}

        {invalid.map(loc => (

          <li

            key={loc.row_index}

            className="rounded px-2 py-1.5 font-mono text-[9px] text-command-critical"

          >

            <span className="block truncate">{loc.display_name ?? loc.address_input}</span>

            {loc.error ? <span className="text-[8px]">{loc.error}</span> : null}

          </li>

        ))}

      </ul>

    </div>

  )

}


