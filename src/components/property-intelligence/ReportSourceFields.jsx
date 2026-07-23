import { useMemo } from 'react'
import { formatCopeSourceLabel } from '../../utils/copeSourceLabels'

const CONFIDENCE_CLASS = {
  high: 'text-command-stable',
  medium: 'text-ink-secondary',
  low: 'text-ink-faint',
  unknown: 'text-ink-faint',
}

function formatFieldKey(key) {
  return String(key ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function FieldCard({ field }) {
  return (
    <li className="rounded border border-panel-border bg-panel-surface/60 px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
          {formatFieldKey(field.key)}
        </span>
        {field.confidence ? (
          <span
            className={`shrink-0 font-mono text-[8px] uppercase ${CONFIDENCE_CLASS[field.confidence] ?? 'text-ink-faint'}`}
          >
            {field.confidence}
          </span>
        ) : null}
      </div>
      {field.value ? (
        <p className="dossier-value mt-1 font-mono text-[11px] leading-snug">{field.value}</p>
      ) : null}
    </li>
  )
}

function SourceColumn({ source, fields }) {
  const label = formatCopeSourceLabel(source)
  const initial = String(label ?? source ?? '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <section className="sources-runway__column cope-runway__column flex min-h-0 min-w-0 flex-col border-panel-border/60">
      <header className="cope-runway__header shrink-0 px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-sm font-semibold tracking-[0.04em]">
            <span className="cope-runway__letter">{initial}</span>
            <span className="cope-runway__label ml-1.5 text-[11px] font-medium">{label}</span>
          </p>
          <span className="cope-runway__count font-mono text-[9px] tabular-nums">
            {fields.length}
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto sleek-scrollbar px-2.5 py-2.5">
        {fields.length > 0 ? (
          <ul className="space-y-1.5">
            {fields.map((field, i) => (
              <FieldCard key={`${field.key}-${i}`} field={field} />
            ))}
          </ul>
        ) : (
          <p className="px-1 py-2 font-mono text-[9px] leading-relaxed text-ink-faint">
            No field observations from this source.
          </p>
        )}
      </div>
    </section>
  )
}

function CrawlExcerptBlock({ url, excerpt }) {
  return (
    <details className="border-t border-panel-border/60 bg-panel-surface/20 px-4 py-3">
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

  const fieldCount = useMemo(
    () => grouped.reduce((sum, [, sourceFields]) => sum + sourceFields.length, 0),
    [grouped],
  )

  if (!grouped.length && !crawlExcerpt && !crawlSourceUrl) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        No per-source field observations returned for this report.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-col border-b border-panel-border">
      <div className="shrink-0 border-b border-panel-border/60 bg-panel-surface/20 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            Sources runway
          </p>
          <span className="font-mono text-[10px] tabular-nums text-command-live">
            {grouped.length} source{grouped.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mt-2 font-mono text-[9px] text-ink-faint">
          {fieldCount} observed field{fieldCount === 1 ? '' : 's'} · grouped by contributing source
        </p>
      </div>

      {grouped.length ? (
        <div className="cope-runway min-h-0 flex-1 overflow-x-auto sleek-scrollbar">
          <div
            className="sources-runway__track divide-x divide-[color:var(--dossier-border,#d6d6d2)]"
            style={{ '--sources-cols': String(Math.max(grouped.length, 1)) }}
          >
            {grouped.map(([source, sourceFields]) => (
              <SourceColumn key={source} source={source} fields={sourceFields} />
            ))}
          </div>
        </div>
      ) : null}

      {crawlSourceUrl || crawlExcerpt ? (
        <CrawlExcerptBlock url={crawlSourceUrl} excerpt={crawlExcerpt} />
      ) : null}
    </div>
  )
}
