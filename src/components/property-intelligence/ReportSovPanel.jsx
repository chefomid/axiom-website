import { useState } from 'react'
import { formatCopeSourceLabel } from '../../utils/copeSourceLabels'
import { formatDisplayValue } from '../../utils/formatDisplayValue'

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

function SovFieldTable({ entries }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-panel-border/70 bg-panel-surface/50">
            <th className="whitespace-nowrap px-3 py-2 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Field
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Value
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Confidence
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Source
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Lanes
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([fieldId, entry]) => {
            const tone = confidenceTone(entry.confidence)
            const source = formatCopeSourceLabel(entry.primary_source) || entry.primary_source || '-'
            const lanes = Array.isArray(entry.supporting_lanes) ? entry.supporting_lanes : []

            return (
              <tr
                key={fieldId}
                className="border-b border-panel-border/50 last:border-b-0 odd:bg-panel-surface/35 even:bg-transparent"
              >
                <td className="px-3 py-2.5 align-top">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                    {formatFieldLabel(fieldId)}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <span className="dossier-value font-mono text-[11px] leading-snug tabular-nums">
                    {formatDisplayValue(entry.value, fieldId) || '-'}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top">
                  {entry.confidence ? (
                    <span className={`font-mono text-[8px] uppercase ${CONFIDENCE_CLASS[tone] ?? ''}`}>
                      {entry.confidence}
                    </span>
                  ) : (
                    <span className="font-mono text-[8px] text-ink-faint">-</span>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <span className="font-mono text-[9px] leading-snug text-ink-secondary">
                    {source}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-ink-faint">
                    {lanes.length > 0 ? lanes.join(' · ') : '-'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
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
              {exportingExcel ? 'Exporting…' : 'Export SOV Excel'}
            </button>
          ) : null}
        </div>
        <SovFieldTable entries={entries} />
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-panel-border/70">
                  <th className="px-2 py-1.5 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                    Field
                  </th>
                  <th className="px-2 py-1.5 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                    Value
                  </th>
                  <th className="px-2 py-1.5 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrichments.map((item, i) => (
                  <tr
                    key={`${item.field_id}-${i}`}
                    className="border-b border-panel-border/50 last:border-b-0"
                  >
                    <td className="px-2 py-2 align-top font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                      {formatFieldLabel(item.field_id)}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span className="dossier-value font-mono text-[11px] leading-snug tabular-nums">
                        {formatDisplayValue(item.value, item.field_id)}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-top font-mono text-[9px] text-ink-faint">
                      {formatCopeSourceLabel(item.source) || item.source || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      ) : null}
    </div>
  )
}
