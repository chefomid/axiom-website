import { WORKFLOW_CTL, WORKFLOW_CTL_NEUTRAL } from './workflowControls'

function StatusPill({ label, value, tone = 'neutral' }) {
  const toneClass =
    tone === 'valid'
      ? 'border-command-stable/35 bg-command-stable/10 text-command-stable'
      : tone === 'invalid'
        ? 'border-command-critical/35 bg-command-critical/10 text-command-critical'
        : 'border-panel-border bg-panel-surface/30 text-ink-secondary'
  return (
    <div className={`rounded-md border px-2.5 py-1.5 text-center ${toneClass}`}>
      <p className="font-mono text-[14px] font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-0.5 font-mono text-[8px] uppercase tracking-wider opacity-80">{label}</p>
    </div>
  )
}

export default function BatchQuotePanel({
  batchQuote,
  scheduleRows = [],
  loadingQuote = false,
  onOpenSchedule,
  onPreviewLocation,
  onFitAllOnMap,
  selectedRowIndex = null,
  scheduleMapReady = false,
}) {
  const queuedCount = scheduleRows.length

  if (!batchQuote && !queuedCount) {
    return (
      <div className="rounded-lg border border-dashed border-panel-border bg-panel-surface/20 px-4 py-5 text-center">
        <p className="font-mono text-[10px] leading-relaxed text-ink-muted">
          Import a spreadsheet or paste addresses to analyze up to 100 locations at once.
        </p>
        <button
          type="button"
          onClick={onOpenSchedule}
          className={`${WORKFLOW_CTL} ${WORKFLOW_CTL_NEUTRAL} mt-4 w-full`}
        >
          Upload schedule
        </button>
      </div>
    )
  }

  if (!batchQuote) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <StatusPill label="Queued" value={queuedCount} />
          <button
            type="button"
            onClick={onOpenSchedule}
            className="font-mono text-[9px] uppercase tracking-wider text-command-live hover:underline"
          >
            Edit
          </button>
        </div>

        <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-panel-border bg-black/30 p-1.5">
          {scheduleRows.map(row => (
            <li
              key={`${row.rowIndex}-${row.address}`}
              className="flex items-start gap-2 rounded px-2 py-1.5 font-mono text-[9px] text-ink-secondary"
            >
              <span className="shrink-0 text-ink-faint">{row.rowIndex}</span>
              <span className="min-w-0 truncate">{row.address}</span>
            </li>
          ))}
        </ul>

        <p className="rounded-md border border-command-watch/20 bg-command-watch/5 px-2.5 py-2 font-mono text-[9px] leading-relaxed text-ink-faint">
          Choose a package below to validate addresses and plot them on the map.
        </p>
      </div>
    )
  }

  const valid = batchQuote.locations?.filter(l => l.status === 'valid') ?? []
  const invalid = batchQuote.locations?.filter(l => l.status === 'invalid') ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 grid-cols-3 gap-1.5">
          <StatusPill label="Valid" value={valid.length} tone="valid" />
          <StatusPill label="Invalid" value={invalid.length} tone={invalid.length ? 'invalid' : 'neutral'} />
          <StatusPill label="Total" value={valid.length + invalid.length} />
        </div>
        <button
          type="button"
          onClick={onOpenSchedule}
          className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-command-live hover:underline"
        >
          Edit
        </button>
      </div>

      {loadingQuote ? (
        <p className="font-mono text-[9px] text-ink-faint">Re-validating schedule…</p>
      ) : null}

      {scheduleMapReady ? (
        <button
          type="button"
          onClick={onFitAllOnMap}
          className={`${WORKFLOW_CTL} ${WORKFLOW_CTL_NEUTRAL} w-full`}
        >
          Fit all on map
        </button>
      ) : null}

      <ul className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-panel-border bg-black/30 p-1.5">
        {valid.map(loc => {
          const selected = selectedRowIndex === loc.row_index
          return (
            <li key={loc.row_index}>
              <button
                type="button"
                onClick={() => onPreviewLocation?.(loc)}
                className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left font-mono text-[9px] transition ${
                  selected
                    ? 'bg-command-live/15 text-white ring-1 ring-command-live/35'
                    : 'text-ink-secondary hover:bg-command-live/8 hover:text-white'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold ${
                    selected ? 'bg-command-live text-black' : 'bg-panel-surface text-ink-muted'
                  }`}
                >
                  {loc.row_index}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{loc.display_name ?? loc.address_input}</span>
                </span>
              </button>
            </li>
          )
        })}
        {invalid.map(loc => (
          <li
            key={loc.row_index}
            className="flex items-start gap-2 rounded px-2 py-1.5 font-mono text-[9px] text-command-critical/90"
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-command-critical/15 text-[8px] font-semibold">
              {loc.row_index}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{loc.display_name ?? loc.address_input}</span>
              {loc.error ? <span className="mt-0.5 block text-[8px] leading-snug opacity-80">{loc.error}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
