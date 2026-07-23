import { useState } from 'react'

const CONFIDENCE_CLASS = {
  high: 'text-command-stable',
  medium: 'text-command-watch',
  low: 'text-ink-faint',
  unknown: 'text-ink-faint',
}

function parseDigestSections(md) {
  if (!md || typeof md !== 'string') return []
  let body = md
  if (body.startsWith('---')) {
    const end = body.indexOf('---', 3)
    if (end !== -1) body = body.slice(end + 3).trim()
  }
  return body
    .split(/^## /m)
    .filter(Boolean)
    .map(chunk => {
      const nl = chunk.indexOf('\n')
      const title = nl === -1 ? chunk.trim() : chunk.slice(0, nl).trim()
      const content = nl === -1 ? '' : chunk.slice(nl + 1).trim()
      return { title, content }
    })
}

function SovFieldTable({ statementOfValues }) {
  const entries = Object.entries(statementOfValues || {})
  if (!entries.length) {
    return <p className="font-mono text-[10px] text-ink-faint">No SOV fields populated.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[9px]">
        <thead>
          <tr className="border-b border-panel-border text-left text-ink-muted">
            <th className="py-1 pr-2">Field</th>
            <th className="py-1 pr-2">Value</th>
            <th className="py-1 pr-2">Source</th>
            <th className="py-1">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([fieldId, entry]) => (
            <tr key={fieldId} className="border-b border-panel-border/40 text-ink-secondary">
              <td className="py-1.5 pr-2 capitalize">{fieldId.replace(/_/g, ' ')}</td>
              <td className="dossier-value py-1.5 pr-2">{entry.value}</td>
              <td className="py-1.5 pr-2 text-ink-faint">{entry.primary_source || '-'}</td>
              <td className={`py-1.5 ${CONFIDENCE_CLASS[entry.confidence] ?? 'text-ink-faint'}`}>
                {entry.confidence || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ReportSovPanel({ statementOfValues, sovDigestMd, sovAnalysis }) {
  const [digestOpen, setDigestOpen] = useState(true)
  const digestSections = parseDigestSections(sovDigestMd)
  const discrepancies = sovAnalysis?.discrepancies || []
  const enrichments = sovAnalysis?.enrichments || []
  const notes = sovAnalysis?.underwriter_notes || []
  const summary = sovAnalysis?.summary

  if (!statementOfValues && !sovDigestMd) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        Statement of Values was not generated for this report.
      </p>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {summary ? (
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Summary</p>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-secondary">{summary}</p>
        </section>
      ) : null}

      <section>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Schedule of values</p>
        <div className="mt-2">
          <SovFieldTable statementOfValues={statementOfValues} />
        </div>
      </section>

      {discrepancies.length > 0 ? (
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Discrepancies</p>
          <ul className="mt-2 space-y-2">
            {discrepancies.map((d, i) => (
              <li
                key={`${d.field_id}-${i}`}
                className="rounded border border-panel-border bg-panel-surface/40 px-3 py-2"
              >
                <p className="dossier-value font-mono text-[10px]">
                  {d.field_id?.replace(/_/g, ' ')}{' '}
                  <span className="text-ink-faint">({d.status})</span>
                </p>
                {d.rationale ? (
                  <p className="mt-1 font-mono text-[9px] text-ink-secondary">{d.rationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {enrichments.length > 0 ? (
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Enrichments</p>
          <ul className="mt-1 space-y-1 font-mono text-[9px] text-ink-secondary">
            {enrichments.map((e, i) => (
              <li key={i}>
                {e.field_id}: {e.value} ({e.source})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notes.length > 0 ? (
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Underwriter notes</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 font-mono text-[9px] text-ink-faint">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {digestSections.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setDigestOpen(v => !v)}
            className="flex w-full items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted hover:text-ink-secondary"
          >
            SOV digest
            <span>{digestOpen ? '−' : '+'}</span>
          </button>
          {digestOpen ? (
            <div className="mt-2 space-y-2">
              {digestSections.map(section => (
                <div
                  key={section.title}
                  className="rounded border border-panel-border bg-panel-surface/30 px-3 py-2"
                >
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
                    {section.title}
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-ink-secondary">
                    {section.content}
                  </pre>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
