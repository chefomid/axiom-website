const CONFIDENCE_CLASS = {
  high: 'text-command-stable',
  medium: 'text-command-watch',
  low: 'text-ink-faint',
  unknown: 'text-ink-faint',
}

const TRUST_METHOD_LABEL = {
  unanimous: 'All sources agree',
  precedence: 'Source precedence',
  tolerance: 'Within tolerance',
  llm: 'LLM reconciled',
  unknown: '',
}

function CompletenessBar({ pct }) {
  return (
    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel-border">
      <div
        className="h-full bg-command-live transition-all duration-500"
        style={{ width: `${Math.min(100, pct ?? 0)}%` }}
      />
    </div>
  )
}

export default function CopeSnapshot({ cope, conflicts }) {
  if (!cope?.sections?.length) {
    return (
      <div className="border-b border-panel-border p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">COPE snapshot</p>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-faint">
          Select <span className="text-ink-secondary">COPE snapshot mapper</span> and generate a report to
          see Construction, Occupancy, Protection, and Exposure.
        </p>
      </div>
    )
  }

  const score = cope.score ?? {}
  const hasAttomData = cope.sections.some(section =>
    section.fields?.some(
      f => f.status === 'observed' && String(f.source ?? '').toLowerCase().includes('attom'),
    ),
  )

  return (
    <div className="border-b border-panel-border">
      <div className="border-b border-panel-border/60 bg-panel-surface/20 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">COPE snapshot</p>
          <span className="font-mono text-[10px] tabular-nums text-command-live">
            {score.completeness_pct ?? 0}% complete
          </span>
        </div>
        <CompletenessBar pct={score.completeness_pct} />
        <p className="mt-2 font-mono text-[9px] text-ink-faint">
          {score.observed ?? 0} observed · {score.unknown ?? 0} unknown · {score.total ?? 0} fields
        </p>
        {score.unknown > 0 ? (
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-command-watch">
            {hasAttomData
              ? 'ATTOM is connected, remaining gaps are missing from the ATTOM record, hazard/protection feeds, or failed sources (see receipt).'
              : 'Add ATTOM (or assessor crawl) for carrier-grade Construction & Occupancy fields.'}
          </p>
        ) : null}
      </div>

      {cope.sections.map(section => (
        <div key={section.id} className="border-b border-panel-border/60 p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="font-display text-xs text-white">
              {section.cope_letter ? `${section.cope_letter}, ` : ''}
              {section.label}
            </p>
            <span className="font-mono text-[9px] tabular-nums text-ink-muted">{section.completeness}</span>
          </div>
          <ul className="space-y-2">
            {section.fields.map(field => (
              <li
                key={field.id}
                className={`rounded border px-3 py-2 ${
                  field.status === 'unknown'
                    ? 'border-panel-border/60 bg-panel-surface/30'
                    : 'border-panel-border bg-panel-surface/60'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                    {field.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {field.method && field.method !== 'unknown' ? (
                      <span className="font-mono text-[8px] uppercase tracking-wider text-ink-faint">
                        {TRUST_METHOD_LABEL[field.method] ?? field.method}
                      </span>
                    ) : null}
                    <span className={`font-mono text-[9px] uppercase ${CONFIDENCE_CLASS[field.confidence] ?? ''}`}>
                      {field.confidence}
                    </span>
                  </div>
                </div>
                {field.value ? (
                  <>
                    <p className="mt-1 font-mono text-xs text-white">{field.value}</p>
                    {field.source ? (
                      <p className="mt-0.5 font-mono text-[9px] text-ink-faint">source: {field.source}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 font-mono text-[10px] italic text-ink-faint">
                    {field.note ?? 'Unknown, not in selected sources'}
                  </p>
                )}
                {field.alternatives?.length > 0 ? (
                  <div className="mt-2 border-t border-panel-border/50 pt-2">
                    <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint">Also reported</p>
                    {field.alternatives.map((alt, i) => (
                      <p key={i} className="mt-0.5 font-mono text-[9px] text-ink-secondary">
                        {alt.value}{' '}
                        <span className="text-ink-faint">({alt.source})</span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {conflicts?.filter(c => c.alternatives?.length > 1)?.length > 0 ? (
        <div className="p-4">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-command-watch">
            Source conflicts
          </p>
          <ul className="space-y-2">
            {conflicts.filter(c => c.alternatives?.length > 1).map(c => (
              <li key={c.field_id} className="rounded border border-command-watch/30 bg-command-watch/5 px-3 py-2">
                <p className="font-mono text-[10px] text-white">{c.field_id.replace(/_/g, ' ')}</p>
                {c.alternatives?.map((alt, i) => (
                  <p key={i} className="mt-1 font-mono text-[9px] text-ink-secondary">
                    {alt.value} <span className="text-ink-faint">, {alt.source}</span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[9px] text-ink-faint">
            {hasAttomData
              ? 'Include conflict resolution in your package to reconcile disagreeing sources.'
              : 'Enable conflict resolution or add ATTOM to pick carrier-trusted values.'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
