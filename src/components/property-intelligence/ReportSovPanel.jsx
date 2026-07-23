import { useState } from 'react'
import { formatCopeSourceLabel } from '../../utils/copeSourceLabels'

const SOV_FIELD_META = [
  { id: 'year_built', label: 'Year built' },
  { id: 'square_footage', label: 'Building sq ft' },
  { id: 'stories', label: 'Number of stories' },
  { id: 'construction_type', label: 'Construction type' },
  { id: 'iso_construction_class', label: 'ISO construction class' },
  { id: 'roof_type', label: 'Roof type' },
  { id: 'property_type', label: 'Property type' },
  { id: 'parcel_number', label: 'Parcel / APN' },
  { id: 'owner_name', label: 'Owner of record' },
  { id: 'zoning', label: 'Zoning / land use' },
  { id: 'occupancy_use', label: 'Occupancy / use code' },
  { id: 'assessed_value', label: 'Assessed value' },
]

const CONFIDENCE_CLASS = {
  high: 'text-command-stable',
  medium: 'text-[#b45309]',
  low: 'text-[#ca8a04]',
  unknown: 'text-ink-faint',
}

function formatFieldLabel(fieldId) {
  const known = SOV_FIELD_META.find(item => item.id === fieldId)
  if (known) return known.label
  return String(fieldId ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function orderSovEntries(statementOfValues) {
  const entries = Object.entries(statementOfValues || {})
  const order = new Map(SOV_FIELD_META.map((item, index) => [item.id, index]))
  return entries.sort(([a], [b]) => {
    const ai = order.has(a) ? order.get(a) : 999
    const bi = order.has(b) ? order.get(b) : 999
    if (ai !== bi) return ai - bi
    return a.localeCompare(b)
  })
}

function confidenceTone(confidence) {
  const value = String(confidence ?? '').toLowerCase()
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'unknown'
}

function SectionHeader({ children }) {
  return (
    <header className="cope-runway__header shrink-0 px-4 py-3">
      <p className="font-display text-sm font-semibold tracking-[0.04em]">
        <span className="cope-runway__label text-[11px] font-medium uppercase tracking-[0.14em]">
          {children}
        </span>
      </p>
    </header>
  )
}

function CollapsibleSection({ title, open, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
      <button
        type="button"
        onClick={onToggle}
        className="cope-runway__header flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:brightness-110"
      >
        <span className="cope-runway__label font-display text-[11px] font-medium uppercase tracking-[0.14em]">
          {title}
        </span>
        <span className="cope-runway__count font-mono text-sm leading-none">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="border-t border-panel-border/60 px-4 py-3">{children}</div> : null}
    </section>
  )
}

function SovFieldRow({ fieldId, entry }) {
  const tone = confidenceTone(entry.confidence)
  const source = formatCopeSourceLabel(entry.primary_source) || entry.primary_source || '-'
  const lanes = Array.isArray(entry.supporting_lanes) ? entry.supporting_lanes : []

  return (
    <li className="rounded border border-panel-border bg-panel-surface/60 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
          {formatFieldLabel(fieldId)}
        </p>
        {entry.confidence ? (
          <span className={`shrink-0 font-mono text-[8px] uppercase ${CONFIDENCE_CLASS[tone] ?? ''}`}>
            {entry.confidence}
          </span>
        ) : null}
      </div>
      <p className="dossier-value mt-1 font-mono text-[11px] leading-snug">{entry.value ?? '-'}</p>
      <div className="mt-1.5 space-y-0.5 border-t border-panel-border/50 pt-1.5">
        <p className="font-mono text-[8px] text-ink-faint">From {source}</p>
        {lanes.length > 0 ? (
          <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint">
            Lanes: {lanes.join(' · ')}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function DiscrepancyCard({ item }) {
  const laneEntries = Object.entries(item.lane_values || {}).filter(
    ([, value]) => value != null && value !== '',
  )

  return (
    <li className="rounded border border-panel-border border-l-[3px] border-l-command-watch/70 bg-panel-surface/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] font-medium text-ink-primary">
          {formatFieldLabel(item.field_id)}
        </p>
        <span className="font-mono text-[8px] uppercase tracking-wider text-ink-faint">
          {item.status || 'unresolved'}
        </span>
      </div>
      {item.resolved_value != null && item.resolved_value !== '' ? (
        <p className="mt-1 font-mono text-[10px] text-ink-secondary">
          Resolved: {String(item.resolved_value)}
        </p>
      ) : null}
      {item.rationale ? (
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-muted">{item.rationale}</p>
      ) : null}
      {laneEntries.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-panel-border/50 pt-2">
          {laneEntries.map(([lane, value]) => (
            <li key={lane} className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[8px] uppercase tracking-wider text-ink-faint">
                {lane.replace(/_/g, ' ')}
              </span>
              <span className="font-mono text-[10px] text-ink-primary">{String(value)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function ReportSovPanel({ statementOfValues, sovAnalysis, onExportExcel, exportingExcel }) {
  const [issuesOpen, setIssuesOpen] = useState(true)
  const [fillsOpen, setFillsOpen] = useState(false)
  const entries = orderSovEntries(statementOfValues)
  const discrepancies = sovAnalysis?.discrepancies || []
  const enrichments = sovAnalysis?.enrichments || []

  if (!entries.length) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        Statement of Values was not generated for this report.
      </p>
    )
  }

  return (
    <div className="space-y-4 border-b border-panel-border p-4">
      <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
        <SectionHeader>Statement of values</SectionHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border/60 px-4 py-2.5">
          <p className="font-mono text-[9px] text-ink-muted">
            {entries.length} field{entries.length === 1 ? '' : 's'} reconciled across source lanes
          </p>
          {onExportExcel ? (
            <button
              type="button"
              onClick={onExportExcel}
              disabled={exportingExcel}
              className="dossier-btn-sovexcel"
            >
              {exportingExcel ? 'Exporting…' : 'Export SovExcel'}
            </button>
          ) : null}
        </div>
        <ul className="space-y-1.5 p-3">
          {entries.map(([fieldId, entry]) => (
            <SovFieldRow key={fieldId} fieldId={fieldId} entry={entry} />
          ))}
        </ul>
      </section>

      {discrepancies.length > 0 ? (
        <CollapsibleSection
          title={`Lane discrepancies · ${discrepancies.length}`}
          open={issuesOpen}
          onToggle={() => setIssuesOpen(v => !v)}
        >
          <ul className="space-y-1.5">
            {discrepancies.map((item, i) => (
              <DiscrepancyCard key={`${item.field_id}-${i}`} item={item} />
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      {enrichments.length > 0 ? (
        <CollapsibleSection
          title={`Gap fills · ${enrichments.length}`}
          open={fillsOpen}
          onToggle={() => setFillsOpen(v => !v)}
        >
          <ul className="space-y-1.5">
            {enrichments.map((item, i) => (
              <li
                key={`${item.field_id}-${i}`}
                className="rounded border border-panel-border bg-panel-surface/60 px-3 py-2.5"
              >
                <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                  {formatFieldLabel(item.field_id)}
                </p>
                <p className="dossier-value mt-1 font-mono text-[11px] leading-snug">{item.value}</p>
                <p className="mt-1 font-mono text-[8px] text-ink-faint">
                  From {formatCopeSourceLabel(item.source) || item.source || '-'}
                </p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}
    </div>
  )
}
