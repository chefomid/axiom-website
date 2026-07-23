import { useState } from 'react'
import { formatCopeSourceLabel } from '../../utils/copeSourceLabels'

const COPE_ORDER = ['C', 'O', 'P', 'E']

const CONFIDENCE_CLASS = {
  high: 'text-command-stable',
  medium: 'text-ink-secondary',
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

function isFieldPopulated(field) {
  return field.status !== 'unknown' && Boolean(field.value)
}

function partitionSection(section) {
  const fields = section.fields ?? []
  const populated = fields.filter(isFieldPopulated)
  const gaps = fields.filter(f => !isFieldPopulated(f))
  return { populated, gaps, total: fields.length }
}

function orderCopeSections(sections) {
  const byLetter = new Map()
  for (const section of sections ?? []) {
    const letter = String(section.cope_letter ?? '').toUpperCase()
    if (!byLetter.has(letter)) byLetter.set(letter, section)
  }
  const ordered = COPE_ORDER.map(letter => byLetter.get(letter)).filter(Boolean)
  const extras = (sections ?? []).filter(
    section => !COPE_ORDER.includes(String(section.cope_letter ?? '').toUpperCase()),
  )
  return [...ordered, ...extras]
}

function FieldCard({ field, variant = 'populated' }) {
  const [sourceOpen, setSourceOpen] = useState(false)
  const isGap = variant === 'gap'
  const methodLabel =
    field.method && field.method !== 'unknown'
      ? (TRUST_METHOD_LABEL[field.method] ?? field.method)
      : ''
  const hasSourceMeta = Boolean(field.source) || Boolean(methodLabel)

  return (
    <li
      className={`rounded border px-2.5 py-2 ${
        isGap
          ? 'border-panel-border bg-panel-bg/40'
          : 'border-panel-border bg-panel-surface/60'
      }`}
    >
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
          {field.label}
        </span>
        {!isGap && field.confidence ? (
          <span className={`shrink-0 font-mono text-[8px] uppercase ${CONFIDENCE_CLASS[field.confidence] ?? ''}`}>
            {field.confidence}
          </span>
        ) : null}
      </div>
      {field.value ? (
        <>
          <div className="mt-1 flex items-start justify-between gap-1.5">
            <p className="dossier-value min-w-0 font-mono text-[11px] leading-snug">{field.value}</p>
            {hasSourceMeta ? (
              <button
                type="button"
                onClick={() => setSourceOpen(v => !v)}
                aria-expanded={sourceOpen}
                aria-label={sourceOpen ? 'Hide source details' : 'Show source details'}
                title={sourceOpen ? 'Hide source' : 'Show source'}
                className="shrink-0 rounded px-0.5 py-0.5 text-ink-faint transition hover:bg-black/[0.04] hover:text-ink-secondary"
              >
                <span
                  className={`block font-mono text-[10px] leading-none transition-transform duration-150 ${
                    sourceOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
            ) : null}
          </div>
          {sourceOpen && hasSourceMeta ? (
            <div className="mt-1 space-y-0.5 border-t border-panel-border/50 pt-1">
              {field.source ? (
                <p className="font-mono text-[8px] text-ink-faint">
                  From {formatCopeSourceLabel(field.source)}
                </p>
              ) : null}
              {methodLabel ? (
                <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint">
                  {methodLabel}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </li>
  )
}

function SectionGaps({ gaps }) {
  const [open, setOpen] = useState(false)
  if (!gaps.length) return null

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-panel-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="These fields were not returned by available sources for this address"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-l-[3px] border-l-command-watch/70 bg-command-watch/[0.12] px-2.5 py-2 text-left transition hover:bg-command-watch/[0.18]"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-secondary">
            {gaps.length} gap{gaps.length === 1 ? '' : 's'}
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-ink-faint">
            · data unavailable
          </span>
        </span>
        <span className="shrink-0 font-mono text-sm leading-none text-ink-faint">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <ul className="space-y-1.5 border-t border-command-watch/20 bg-panel-surface/60 px-2.5 py-2">
          {gaps.map(field => (
            <FieldCard key={field.id} field={field} variant="gap" />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function CopeColumn({ section }) {
  const { populated, gaps, total } = partitionSection(section)
  const letter = String(section.cope_letter ?? '').toUpperCase() || '—'

  return (
    <section className="cope-runway__column flex min-h-0 min-w-0 flex-col border-panel-border/60">
      <header className="cope-runway__header shrink-0 px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-sm font-semibold tracking-[0.04em]">
            <span className="cope-runway__letter">{letter}</span>
            <span className="cope-runway__label ml-1.5 text-[11px] font-medium">
              {section.label}
            </span>
          </p>
          <span className="cope-runway__count font-mono text-[9px] tabular-nums">
            {populated.length}/{total}
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto sleek-scrollbar px-2.5 py-2.5">
        {populated.length > 0 ? (
          <ul className="space-y-1.5">
            {populated.map(field => (
              <FieldCard key={field.id} field={field} variant="populated" />
            ))}
          </ul>
        ) : (
          <p className="px-1 py-2 font-mono text-[9px] leading-relaxed text-ink-faint">
            No observed fields in this column yet.
          </p>
        )}
        <SectionGaps gaps={gaps} />
      </div>
    </section>
  )
}

export default function CopeSnapshot({ cope }) {
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
  const columns = orderCopeSections(cope.sections)

  return (
    <div className="flex min-h-0 flex-col border-b border-panel-border">
      <div className="shrink-0 border-b border-panel-border/60 bg-panel-surface/20 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">COPE runway</p>
          <span className="font-mono text-[10px] tabular-nums text-command-live">
            {score.completeness_pct ?? 0}% complete
          </span>
        </div>
        <CompletenessBar pct={score.completeness_pct} />
        <p className="mt-2 font-mono text-[9px] text-ink-faint">
          {score.observed ?? 0} observed · {score.unknown ?? 0} unknown · {score.total ?? 0} fields
        </p>
        {score.unknown > 0 ? (
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-ink-secondary">
            {hasAttomData
              ? 'Remaining gaps are missing from vendor records, hazard/protection feeds, or sources that did not return for this address.'
              : 'Add ATTOM (or assessor crawl) for detailed Construction & Occupancy from licensed sources.'}
          </p>
        ) : null}
      </div>

      <div className="cope-runway min-h-0 flex-1 overflow-x-auto sleek-scrollbar">
        <div className="cope-runway__track grid h-full min-h-[22rem] min-w-[52rem] grid-cols-4 divide-x divide-[color:var(--dossier-border,#d6d6d2)] lg:min-w-0">
          {columns.map(section => (
            <CopeColumn key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  )
}
