import { useState } from 'react'
import { formatCopeSourceLabel } from '../../utils/copeSourceLabels'

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

function isFieldPopulated(field) {
  return field.status !== 'unknown' && Boolean(field.value)
}

function partitionSection(section) {
  const fields = section.fields ?? []
  const populated = fields.filter(isFieldPopulated)
  const gaps = fields.filter(f => !isFieldPopulated(f))
  return { populated, gaps, total: fields.length }
}

function sortSections(sections) {
  return [...sections].sort((a, b) => {
    const aPop = partitionSection(a).populated.length
    const bPop = partitionSection(b).populated.length
    if (aPop > 0 && bPop === 0) return -1
    if (bPop > 0 && aPop === 0) return 1
    return bPop - aPop
  })
}

function FieldCard({ field, variant = 'populated' }) {
  const isGap = variant === 'gap'
  return (
    <li
      className={`rounded border px-3 py-2 ${
        isGap
          ? 'border-command-watch/25 bg-command-watch/[0.04]'
          : 'border-panel-border bg-panel-surface/60'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          {field.label}
        </span>
        {!isGap ? (
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
        ) : null}
      </div>
      {field.value ? (
        <>
          <p className="dossier-value mt-1 font-mono text-xs">{field.value}</p>
          {field.source ? (
            <p className="mt-0.5 font-mono text-[9px] text-ink-faint">
              From {formatCopeSourceLabel(field.source)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 font-mono text-[10px] italic text-command-watch/80">
          {field.note ?? 'Not found in selected sources'}
        </p>
      )}
    </li>
  )
}

function SectionGaps({ gaps }) {
  const [open, setOpen] = useState(false)
  if (!gaps.length) return null

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-command-watch/30 bg-command-watch/[0.06]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-command-watch/[0.08]"
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-command-watch">
          {gaps.length} field{gaps.length === 1 ? '' : 's'} not found
        </span>
        <span className="font-mono text-sm leading-none text-command-watch/60">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-command-watch/20 px-3 py-3">
          {gaps.map(field => (
            <FieldCard key={field.id} field={field} variant="gap" />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function PopulatedSection({ section }) {
  const { populated, gaps, total } = partitionSection(section)
  const hasGaps = gaps.length > 0

  return (
    <div
      className={`border-b border-panel-border/60 p-4 ${
        hasGaps ? 'border-l-[3px] border-l-command-watch/50' : ''
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="dossier-value font-display text-xs">
          {section.cope_letter ? `${section.cope_letter}, ` : ''}
          {section.label}
        </p>
        <span
          className={`font-mono text-[9px] tabular-nums ${hasGaps ? 'text-command-watch' : 'text-ink-muted'}`}
        >
          {hasGaps ? `${populated.length} of ${total} found` : section.completeness}
        </span>
      </div>
      {populated.length > 0 ? (
        <ul className="space-y-2">
          {populated.map(field => (
            <FieldCard key={field.id} field={field} variant="populated" />
          ))}
        </ul>
      ) : null}
      <SectionGaps gaps={gaps} />
    </div>
  )
}

function UnavailableSections({ sections }) {
  const [open, setOpen] = useState(false)
  if (!sections.length) return null

  const totalGaps = sections.reduce((sum, s) => sum + partitionSection(s).gaps.length, 0)

  return (
    <div className="border-t-2 border-command-watch/30 bg-command-watch/[0.04]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-command-watch/[0.06]"
      >
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-command-watch">
            Sections with no data
          </p>
          <p className="mt-1 font-mono text-[9px] text-ink-faint">
            {sections.length} section{sections.length === 1 ? '' : 's'} · {totalGaps} field
            {totalGaps === 1 ? '' : 's'} unavailable for this location
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm leading-none text-command-watch/60">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div className="border-t border-command-watch/20">
          {sections.map(section => {
            const { gaps } = partitionSection(section)
            return (
              <div key={section.id} className="border-b border-command-watch/15 p-4 last:border-0">
                <p className="mb-2 font-display text-xs text-command-watch/90">
                  {section.cope_letter ? `${section.cope_letter}, ` : ''}
                  {section.label}
                </p>
                <ul className="space-y-2">
                  {gaps.map(field => (
                    <FieldCard key={field.id} field={field} variant="gap" />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
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

  const sorted = sortSections(cope.sections)
  const withData = sorted.filter(s => partitionSection(s).populated.length > 0)
  const withoutData = sorted.filter(s => partitionSection(s).populated.length === 0)

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
        {withData.length > 0 && withoutData.length > 0 ? (
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-ink-secondary">
            Showing {withData.length} section{withData.length === 1 ? '' : 's'} with data first. Scroll down
            for unavailable fields.
          </p>
        ) : null}
        {score.unknown > 0 ? (
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-command-watch">
            {hasAttomData
              ? 'Remaining gaps are missing from vendor records, hazard/protection feeds, or sources that did not return for this address.'
              : 'Add ATTOM (or assessor crawl) for detailed Construction & Occupancy from licensed sources.'}
          </p>
        ) : null}
      </div>

      {withData.map(section => (
        <PopulatedSection key={section.id} section={section} />
      ))}

      <UnavailableSections sections={withoutData} />
    </div>
  )
}
