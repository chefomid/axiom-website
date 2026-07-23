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
  if (value === 'high') return 'high'
  if (value === 'medium') return 'medium'
  if (value === 'low') return 'low'
  return 'unknown'
}

function SovFieldRow({ fieldId, entry }) {
  const tone = confidenceTone(entry.confidence)
  const source = formatCopeSourceLabel(entry.primary_source) || entry.primary_source || '—'
  const lanes = Array.isArray(entry.supporting_lanes) ? entry.supporting_lanes : []

  return (
    <tr>
      <th scope="row" className="sov-ledger__cell sov-ledger__cell--field">
        {formatFieldLabel(fieldId)}
      </th>
      <td className="sov-ledger__cell sov-ledger__cell--value">{entry.value ?? '—'}</td>
      <td className="sov-ledger__cell sov-ledger__cell--confidence">
        {entry.confidence ? (
          <span className={`sov-ledger__confidence sov-ledger__confidence--${tone}`}>
            {entry.confidence}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="sov-ledger__cell sov-ledger__cell--source">{source}</td>
      <td className="sov-ledger__cell sov-ledger__cell--lanes">
        {lanes.length > 0 ? lanes.join(' · ') : '—'}
      </td>
    </tr>
  )
}

function DiscrepancyCard({ item }) {
  const laneEntries = Object.entries(item.lane_values || {}).filter(([, value]) => value != null && value !== '')
  return (
    <li className={`sov-ledger__issue sov-ledger__issue--${item.status || 'unresolved'}`}>
      <div className="sov-ledger__issue-top">
        <p className="sov-ledger__issue-title">{formatFieldLabel(item.field_id)}</p>
        <span className="sov-ledger__issue-status">{item.status || 'unresolved'}</span>
      </div>
      {item.resolved_value != null && item.resolved_value !== '' ? (
        <p className="sov-ledger__issue-value">Resolved: {String(item.resolved_value)}</p>
      ) : null}
      {item.rationale ? <p className="sov-ledger__issue-note">{item.rationale}</p> : null}
      {laneEntries.length > 0 ? (
        <ul className="sov-ledger__lanes">
          {laneEntries.map(([lane, value]) => (
            <li key={lane}>
              <span>{lane.replace(/_/g, ' ')}</span>
              <strong>{String(value)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function ReportSovPanel({ statementOfValues, sovAnalysis, onExportExcel, exportingExcel }) {
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
    <div className="sov-ledger">
      <div className="sov-ledger__toolbar">
        <div>
          <p className="sov-ledger__eyebrow">Statement of values</p>
          <p className="sov-ledger__count">
            {entries.length} field{entries.length === 1 ? '' : 's'} reconciled across source lanes
          </p>
        </div>
        {onExportExcel ? (
          <button
            type="button"
            onClick={onExportExcel}
            disabled={exportingExcel}
            className="dossier-btn-secondary"
          >
            {exportingExcel ? 'Exporting…' : 'Export SOV Excel'}
          </button>
        ) : null}
      </div>

      <div className="sov-ledger__scroll sleek-scrollbar">
        <div className="sov-ledger__table-wrap">
          <table className="sov-ledger__table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Value</th>
                <th scope="col">Confidence</th>
                <th scope="col">Primary source</th>
                <th scope="col">Supporting lanes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([fieldId, entry]) => (
                <SovFieldRow key={fieldId} fieldId={fieldId} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>

        {discrepancies.length > 0 ? (
          <section className="sov-ledger__section">
            <h3 className="sov-ledger__section-title">Lane discrepancies</h3>
            <ul className="sov-ledger__issues">
              {discrepancies.map((item, i) => (
                <DiscrepancyCard key={`${item.field_id}-${i}`} item={item} />
              ))}
            </ul>
          </section>
        ) : null}

        {enrichments.length > 0 ? (
          <section className="sov-ledger__section">
            <h3 className="sov-ledger__section-title">Gap fills</h3>
            <ul className="sov-ledger__enrichments">
              {enrichments.map((item, i) => (
                <li key={`${item.field_id}-${i}`}>
                  <span className="sov-ledger__enrich-label">{formatFieldLabel(item.field_id)}</span>
                  <span className="sov-ledger__enrich-value">{item.value}</span>
                  <span className="sov-ledger__enrich-source">
                    {formatCopeSourceLabel(item.source) || item.source || '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
