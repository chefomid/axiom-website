const SOURCE_LABELS = {
  fema: 'FEMA flood',
  nws: 'NWS alerts',
  usgs: 'USGS seismic',
  wildfire: 'Wildfire',
  aqi: 'Air quality',
  epa: 'EPA ECHO',
}

function renderValue(value, depth = 0) {
  if (value == null) return null
  if (typeof value !== 'object') {
    return (
      <p className="dossier-value font-mono text-xs">{String(value)}</p>
    )
  }
  if (Array.isArray(value)) {
    if (!value.length) return null
    return (
      <ul className="mt-1 space-y-1">
        {value.slice(0, 8).map((item, i) => (
          <li key={i} className="font-mono text-[10px] text-ink-secondary">
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <dl className="mt-1 space-y-1">
      {Object.entries(value)
        .filter(([, v]) => v != null && v !== '')
        .slice(0, 12)
        .map(([key, val]) => (
          <div key={key}>
            <dt className="font-mono text-[8px] uppercase tracking-wider text-ink-faint">{key}</dt>
            <dd className="font-mono text-[10px] text-ink-secondary">
              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
            </dd>
          </div>
        ))}
    </dl>
  )
}

export default function ReportHazardsPanel({ hazards }) {
  const entries = Object.entries(hazards ?? {}).filter(([, data]) => data && typeof data === 'object')

  if (!entries.length) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        No hazard payloads returned. Add hazard sources (FEMA, NWS, USGS, etc.) to your package.
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {entries.map(([key, data]) => (
        <div key={key} className="border-b border-panel-border/60 p-4">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            {SOURCE_LABELS[key] ?? key}
          </p>
          {data.summary ? (
            <p className="dossier-value font-mono text-xs">{data.summary}</p>
          ) : null}
          {data.error ? (
            <p className="mt-1 font-mono text-[10px] text-command-critical">{data.error}</p>
          ) : null}
          {renderValue(
            Object.fromEntries(
              Object.entries(data).filter(([k]) => !['summary', 'error'].includes(k)),
            ),
          )}
        </div>
      ))}
    </div>
  )
}
