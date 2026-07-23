import { useMemo } from 'react'
import { formatCopeSourceLabel } from '../../utils/copeSourceLabels'

function formatFieldKey(key) {
  return String(key ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function FieldRow({ field }) {
  const confidence = String(field.confidence ?? '').toLowerCase()

  return (
    <li className={`sources-rail__field sources-rail__field--${confidence || 'unknown'}`}>
      <p className="sources-rail__field-key">{formatFieldKey(field.key)}</p>
      {field.value ? <p className="sources-rail__field-value">{field.value}</p> : null}
    </li>
  )
}

function SourcePanel({ source, fields }) {
  const label = formatCopeSourceLabel(source)

  return (
    <section className="sources-rail__panel">
      <header className="sources-rail__panel-head">
        <h3 className="sources-rail__panel-title">{label}</h3>
      </header>

      <div className="sources-rail__panel-body sleek-scrollbar">
        {fields.length > 0 ? (
          <ul className="sources-rail__fields">
            {fields.map((field, i) => (
              <FieldRow key={`${field.key}-${i}`} field={field} />
            ))}
          </ul>
        ) : (
          <p className="sources-rail__empty">No field observations from this source.</p>
        )}
      </div>
    </section>
  )
}

function CrawlExcerptBlock({ url, excerpt }) {
  return (
    <details className="sources-rail__crawl">
      <summary>Crawl excerpt</summary>
      {url ? <p className="sources-rail__crawl-url">{url}</p> : null}
      {excerpt ? (
        <pre className="sources-rail__crawl-pre sleek-scrollbar">{excerpt}</pre>
      ) : (
        <p className="sources-rail__empty">No excerpt captured.</p>
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

  if (!grouped.length && !crawlExcerpt && !crawlSourceUrl) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        No per-source field observations returned for this report.
      </p>
    )
  }

  return (
    <div className="sources-rail">
      {grouped.length ? (
        <div className="sources-rail__scroll sleek-scrollbar">
          <div
            className="sources-rail__track"
            style={{ '--sources-cols': String(Math.max(grouped.length, 1)) }}
          >
            {grouped.map(([source, sourceFields]) => (
              <SourcePanel key={source} source={source} fields={sourceFields} />
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
