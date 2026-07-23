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

function CollapsibleSection({ title, open, onToggle, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30 ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="cope-runway__header flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:brightness-110"
      >
        <span className="cope-runway__label font-display text-[11px] font-medium uppercase tracking-[0.14em]">
          {title}
        </span>
        <span className="cope-runway__count font-mono text-sm leading-none">{open ? '-' : '+'}</span>
      </button>
      {open ? <div className="border-t border-panel-border/60 px-4 py-3">{children}</div> : null}
    </section>
  )
}

function SovFieldTable({ entries }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-panel-border/70 bg-[#f3f3f1]">
            <th className="whitespace-nowrap px-3 py-2 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-[#3a3a3a]">
              Field
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-[#3a3a3a]">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([fieldId, entry]) => (
            <tr
              key={fieldId}
              className="border-b border-panel-border/40 last:border-b-0 odd:bg-[#f7f7f5] even:bg-white"
            >
              <td className="px-3 py-2.5 align-top">
                <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[#1c1c1c]">
                  {formatFieldLabel(fieldId)}
                </span>
              </td>
              <td className="px-3 py-2.5 align-top">
                <span className="font-mono text-[12px] leading-snug tabular-nums text-[#141414]">
                  {formatDisplayValue(entry.value, fieldId) || '-'}
                </span>
              </td>
            </tr>
          ))}
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
    <li className="rounded border border-panel-border border-l-[3px] border-l-command-watch/70 bg-white px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] font-medium text-[#1c1c1c]">
          {formatFieldLabel(item.field_id)}
        </p>
        <span className="font-mono text-[8px] uppercase tracking-wider text-[#5a5a5a]">
          {item.status || 'unresolved'}
        </span>
      </div>
      {item.resolved_value != null && item.resolved_value !== '' ? (
        <p className="mt-1 font-mono text-[10px] text-[#2a2a2a]">
          Resolved: {String(item.resolved_value)}
        </p>
      ) : null}
      {item.rationale ? (
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-[#3a3a3a]">{item.rationale}</p>
      ) : null}
      {laneEntries.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-panel-border/50 pt-2">
          {laneEntries.map(([lane, value]) => (
            <li key={lane} className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[8px] uppercase tracking-wider text-[#5a5a5a]">
                {lane.replace(/_/g, ' ')}
              </span>
              <span className="font-mono text-[10px] text-[#141414]">{String(value)}</span>
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
  const hasDiscrepancies = discrepancies.length > 0

  if (!entries.length) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        Statement of Values was not generated for this report.
      </p>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div
        className={
          hasDiscrepancies
            ? 'grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]'
            : ''
        }
      >
        <section className="min-w-0 overflow-hidden rounded-lg border border-panel-border/80 bg-white">
          <SectionHeader>Statement of values</SectionHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border/60 px-4 py-2.5">
            <p className="font-mono text-[9px] text-[#3a3a3a]">
              {entries.length} field{entries.length === 1 ? '' : 's'} reconciled across source lanes
            </p>
            {onExportExcel ? (
              <button
                type="button"
                onClick={onExportExcel}
                disabled={exportingExcel}
                className="dossier-btn-sovexcel"
              >
                {exportingExcel ? 'Exporting...' : 'Export SOV Excel'}
              </button>
            ) : null}
          </div>
          <SovFieldTable entries={entries} />
        </section>

        {hasDiscrepancies ? (
          <CollapsibleSection
            className="min-w-0 lg:sticky lg:top-0"
            title={`Lane discrepancies · ${discrepancies.length}`}
            open={issuesOpen}
            onToggle={() => setIssuesOpen(v => !v)}
          >
            <ul className="max-h-[min(70vh,36rem)] space-y-1.5 overflow-y-auto sleek-scrollbar">
              {discrepancies.map((item, i) => (
                <DiscrepancyCard key={`${item.field_id}-${i}`} item={item} />
              ))}
            </ul>
          </CollapsibleSection>
        ) : null}
      </div>

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
                  <th className="px-2 py-1.5 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-[#3a3a3a]">
                    Field
                  </th>
                  <th className="px-2 py-1.5 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-[#3a3a3a]">
                    Value
                  </th>
                  <th className="px-2 py-1.5 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-[#3a3a3a]">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrichments.map((item, i) => (
                  <tr
                    key={`${item.field_id}-${i}`}
                    className="border-b border-panel-border/40 last:border-b-0 odd:bg-[#f7f7f5] even:bg-white"
                  >
                    <td className="px-2 py-2 align-top font-mono text-[9px] font-medium uppercase tracking-wider text-[#1c1c1c]">
                      {formatFieldLabel(item.field_id)}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span className="font-mono text-[11px] leading-snug tabular-nums text-[#141414]">
                        {formatDisplayValue(item.value, item.field_id)}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-top font-mono text-[9px] text-[#2a2a2a]">
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
