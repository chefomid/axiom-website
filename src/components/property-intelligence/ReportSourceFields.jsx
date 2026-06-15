import { useMemo } from 'react'
import { formatCopeSourceLabel } from '../../utils/copeSourceLabels'

const CONFIDENCE_CLASS = {
  high: 'text-command-stable',
  medium: 'text-command-watch',
  low: 'text-ink-faint',
  unknown: 'text-ink-faint',
}

function formatFieldKey(key) {
  return String(key ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function ReportSourceFields({ fields, crawlExcerpt, crawlSourceUrl }) {
  const grouped = useMemo(() => {
    const bySource = {}
    for (const field of fields ?? []) {
      if (!field?.value) continue
      const source = field.source ?? 'unknown'
      if (!bySource[source]) bySource[source] = []
      bySource[source].push(field)
    }
    return Object.entries(bySource).sort(([a], [b]) => a.localeCompare(b))
  }, [fields])

  if (!grouped.length && !crawlExcerpt && !crawlSourceUrl) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        No per-source field observations returned for this report.
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {grouped.map(([source, sourceFields]) => (
        <div key={source} className="border-b border-panel-border/60 p-4">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            {formatCopeSourceLabel(source)}
          </p>
          <ul className="space-y-2">
            {sourceFields.map((field, i) => (
              <li
                key={`${field.key}-${i}`}
                className="rounded border border-panel-border bg-panel-surface/60 px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                    {formatFieldKey(field.key)}
                  </span>
                  <span
                    className={`font-mono text-[9px] uppercase ${CONFIDENCE_CLASS[field.confidence] ?? 'text-ink-faint'}`}
                  >
                    {field.confidence ?? 'unknown'}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-white">{field.value}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {crawlSourceUrl || crawlExcerpt ? (
        <CrawlExcerptBlock url={crawlSourceUrl} excerpt={crawlExcerpt} />
      ) : null}
    </div>
  )
}

function CrawlExcerptBlock({ url, excerpt }) {
  return (
    <details className="border-b border-panel-border/60 p-4">
      <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
        Crawl excerpt
      </summary>
      {url ? (
        <p className="mt-2 break-all font-mono text-[9px] text-command-live">{url}</p>
      ) : null}
      {excerpt ? (
        <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-panel-border bg-panel-surface/40 p-2 font-mono text-[9px] leading-relaxed text-ink-secondary sleek-scrollbar">
          {excerpt}
        </pre>
      ) : (
        <p className="mt-2 font-mono text-[9px] text-ink-faint">No excerpt captured.</p>
      )}
    </details>
  )
}
