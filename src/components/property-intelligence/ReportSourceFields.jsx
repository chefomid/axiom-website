import { useMemo, useState } from 'react'
import { formatCopeSourceLabel } from '../../utils/copeSourceLabels'
import { formatDisplayValue } from '../../utils/formatDisplayValue'

function formatFieldKey(key) {
  return String(key ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function FieldCard({ field }) {
  return (
    <li className="rounded border border-panel-border bg-panel-surface/60 px-2.5 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
        {formatFieldKey(field.key)}
      </p>
      {field.value ? (
        <p className="dossier-value mt-1 font-mono text-[11px] leading-snug tabular-nums">
          {formatDisplayValue(field.value, field.key)}
        </p>
      ) : null}
    </li>
  )
}

function SourceBlock({ source, fields }) {
  const label = formatCopeSourceLabel(source)

  return (
    <section className="border-b border-[color:var(--dossier-border,#d6d6d2)] last:border-b-0">
      <header className="cope-runway__header px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-sm font-semibold tracking-[0.04em]">
            <span className="cope-runway__label text-[11px] font-medium uppercase tracking-[0.14em]">
              {label}
            </span>
          </p>
          <p className="cope-runway__count font-mono text-[9px] tabular-nums">
            {fields.length} field{fields.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      <div className="px-3 py-3">
        {fields.length > 0 ? (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
  const [open, setOpen] = useState(false)

  return (
    <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="cope-runway__header flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:brightness-110"
      >
        <span className="cope-runway__label font-display text-[11px] font-medium uppercase tracking-[0.14em]">
          Crawl excerpt
        </span>
        <span className="cope-runway__count font-mono text-sm leading-none">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="border-t border-panel-border/60 px-4 py-3">
          {url ? (
            <p className="break-all font-mono text-[10px] text-ink-faint">{url}</p>
          ) : null}
          {excerpt ? (
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-panel-border bg-panel-surface px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-secondary sleek-scrollbar">
              {excerpt}
            </pre>
          ) : (
            <p className="font-mono text-[9px] text-ink-faint">No excerpt captured.</p>
          )}
        </div>
      ) : null}
    </section>
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

  if (!grouped.length && !crawlExcerpt && !crawlSourceUrl) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        No per-source field observations returned for this report.
      </p>
    )
  }

  return (
    <div className="border-b border-panel-border">
      {grouped.length ? (
        <div className="divide-y divide-[color:var(--dossier-border,#d6d6d2)] bg-[color:var(--dossier-surface,#ffffff)]">
          {grouped.map(([source, sourceFields]) => (
            <SourceBlock key={source} source={source} fields={sourceFields} />
          ))}
        </div>
      ) : null}

      {crawlSourceUrl || crawlExcerpt ? (
        <div className="p-4">
          <CrawlExcerptBlock url={crawlSourceUrl} excerpt={crawlExcerpt} />
        </div>
      ) : null}
    </div>
  )
}
