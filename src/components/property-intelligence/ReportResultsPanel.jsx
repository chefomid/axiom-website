import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { publicDataCommandAtLocation } from '../../constants/routes'
import CopeSnapshot from './CopeSnapshot'

export default function ReportResultsPanel({ record, error, loading, apiOnline }) {
  const [open, setOpen] = useState(Boolean(record))

  useEffect(() => {
    if (record) setOpen(true)
  }, [record])

  if (loading) {
    return (
      <div className="border-b border-panel-border px-4 py-3">
        <p className="font-mono text-[10px] text-ink-muted">Building COPE snapshot…</p>
      </div>
    )
  }

  if (error) {
    const isGeocodeMiss = /could not be geocoded/i.test(error)
    const isApiOffline = apiOnline === false || /failed to fetch|network/i.test(error)

    return (
      <div className="border-b border-command-critical/30 bg-command-critical/5 px-4 py-3">
        <p className="font-mono text-[10px] text-command-critical">{error}</p>
        {isGeocodeMiss ? (
          <p className="mt-1 font-mono text-[9px] text-ink-faint">
            Use a full street address with city, state, and ZIP.
          </p>
        ) : null}
        {isApiOffline ? (
          <p className="mt-1 font-mono text-[9px] text-ink-faint">
            Run <code className="text-ink-secondary">npm run property-api</code> in a separate terminal.
          </p>
        ) : null}
      </div>
    )
  }

  if (!record) return null

  const hazardLink =
    record.lat != null && record.lng != null
      ? publicDataCommandAtLocation(record.lat, record.lng)
      : null

  return (
    <div className="border-b border-panel-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-panel-surface/30"
      >
        <span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Report results</span>
          <span className="mt-0.5 block font-mono text-[10px] capitalize text-command-stable">{record.status}</span>
        </span>
        <span className="font-mono text-[10px] text-ink-faint">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="max-h-[min(50vh,420px)] overflow-y-auto sleek-scrollbar border-t border-panel-border/60">
          {record.report_id ? (
            <p className="border-b border-panel-border/60 px-4 py-2 font-mono text-[9px] tabular-nums text-ink-faint">
              {record.report_id}
            </p>
          ) : null}
          {hazardLink ? (
            <div className="border-b border-panel-border/60 px-4 py-2">
              <Link
                to={hazardLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[9px] uppercase tracking-widest text-command-live hover:underline"
              >
                Live hazards at this location (opens in new tab) →
              </Link>
            </div>
          ) : null}
          <CopeSnapshot cope={record.cope} conflicts={record.conflicts} />
        </div>
      ) : null}
    </div>
  )
}
