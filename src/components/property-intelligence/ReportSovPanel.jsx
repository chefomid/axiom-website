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
      {open ? <div className="border-t border-panel-border/60">{children}</div> : null}
    </section>
  )
}

function TableShell({ children, minWidth = '40rem' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

function Th({ children, className = '' }) {
  return (
    <th
      className={`border-b border-panel-border/70 bg-panel-surface/50 px-3 py-2 font-mono text-[8px] font-medium uppercase tracking-[0.12em] text-ink-faint ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }) {
  return (
    <td className={`border-b border-panel-border/40 px-3 py-2 align-top font-mono text-[10px] text-ink-primary ${className}`}>
      {children}
    </td>
  )
}

function SovFieldsTable({ entries }) {
  return (
    <TableShell minWidth="44rem">
      <thead>
        <tr>
          <Th className="w-[22%]">Field</Th>
          <Th className="w-[28%]">Value</Th>
          <Th className="w-[20%]">Primary source</Th>
          <Th className="w-[12%]">Confidence</Th>
          <Th className="w-[18%]">Supporting lanes</Th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([fieldId, entry]) => {
          const tone = confidenceTone(entry.confidence)
          const source = formatCopeSourceLabel(entry.primary_source) || entry.primary_source || '-'
          const lanes = Array.isArray(entry.supporting_lanes) ? entry.supporting_lanes : []

          return (
            <tr key={fieldId} className="bg-panel-surface/20 hover:bg-panel-surface/45">
              <Td className="text-[9px] uppercase tracking-wider text-ink-muted">
                {formatFieldLabel(fieldId)}
              </Td>
              <Td className="dossier-value text-[11px] leading-snug">{entry.value ?? '-'}</Td>
              <Td className="text-[9px] text-ink-faint">{source}</Td>
              <Td>
                {entry.confidence ? (
                  <span className={`text-[8px] uppercase ${CONFIDENCE_CLASS[tone] ?? ''}`}>
                    {entry.confidence}
                  </span>
                ) : (
                  <span className="text-ink-faint">-</span>
                )}
              </Td>
              <Td className="text-[8px] uppercase tracking-wider text-ink-faint">
                {lanes.length > 0 ? lanes.join(' · ') : '-'}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}

function DiscrepanciesTable({ items }) {
  return (
    <TableShell minWidth="48rem">
      <thead>
        <tr>
          <Th className="w-[16%]">Field</Th>
          <Th className="w-[12%]">Status</Th>
          <Th className="w-[16%]">Resolved</Th>
          <Th className="w-[28%]">Rationale</Th>
          <Th className="w-[28%]">Lane values</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const laneEntries = Object.entries(item.lane_values || {}).filter(
            ([, value]) => value != null && value !== '',
          )

          return (
            <tr
              key={`${item.field_id}-${i}`}
              className="border-l-[3px] border-l-command-watch/70 bg-panel-surface/20 hover:bg-panel-surface/45"
            >
              <Td className="text-[10px] font-medium">{formatFieldLabel(item.field_id)}</Td>
              <Td className="text-[8px] uppercase tracking-wider text-ink-faint">
                {item.status || 'unresolved'}
              </Td>
              <Td className="text-[10px] text-ink-secondary">
                {item.resolved_value != null && item.resolved_value !== ''
                  ? String(item.resolved_value)
                  : '-'}
              </Td>
              <Td className="text-[10px] leading-relaxed text-ink-muted">
                {item.rationale || '-'}
              </Td>
              <Td>
                {laneEntries.length > 0 ? (
                  <ul className="space-y-1">
                    {laneEntries.map(([lane, value]) => (
                      <li key={lane} className="flex items-baseline justify-between gap-3">
                        <span className="text-[8px] uppercase tracking-wider text-ink-faint">
                          {lane.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-ink-primary">{String(value)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-ink-faint">-</span>
                )}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}

function EnrichmentsTable({ items }) {
  return (
    <TableShell minWidth="32rem">
      <thead>
        <tr>
          <Th className="w-[28%]">Field</Th>
          <Th className="w-[44%]">Value</Th>
          <Th className="w-[28%]">Source</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={`${item.field_id}-${i}`} className="bg-panel-surface/20 hover:bg-panel-surface/45">
            <Td className="text-[9px] uppercase tracking-wider text-ink-muted">
              {formatFieldLabel(item.field_id)}
            </Td>
            <Td className="dossier-value text-[11px] leading-snug">{item.value ?? '-'}</Td>
            <Td className="text-[9px] text-ink-faint">
              {formatCopeSourceLabel(item.source) || item.source || '-'}
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

export default function ReportSovPanel({ statementOfValues, sovCtrlAnalysis, onExportExcel, exportingExcel }) {
  // Keep prop name compatible with callers (sovAnalysis)
  return null
}
