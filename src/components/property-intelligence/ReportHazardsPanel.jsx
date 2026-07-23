const HAZARD_META = {
  fema: { label: 'FEMA flood', agency: 'NFHL' },
  nws: { label: 'NWS alerts', agency: 'Weather' },
  usgs: { label: 'USGS seismic', agency: 'Earthquake' },
  wildfire: { label: 'Wildfire', agency: 'NASA EONET' },
  aqi: { label: 'Air quality', agency: 'Open-Meteo' },
  epa: { label: 'EPA ECHO', agency: 'Facilities' },
}

const SKIP_KEYS = new Set(['summary', 'error', 'alerts', 'events', 'zone', 'sfha', 'subtype', 'count', 'us_aqi', 'pm2_5'])

function formatKey(key) {
  return String(key ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatScalar(value) {
  if (value == null || value === '') return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return null
  return String(value)
}

function toneForHazard(key, data) {
  if (data?.error) return 'error'
  if (key === 'fema') {
    if (data?.sfha) return 'elevated'
    if (data?.zone && String(data.zone).toUpperCase() !== 'X') return 'watch'
    return 'clear'
  }
  if (key === 'nws') {
    const count = Number(data?.count ?? data?.alerts?.length ?? 0)
    if (count <= 0) return 'clear'
    const severities = (data?.alerts ?? []).map(a => String(a.severity ?? '').toLowerCase())
    if (severities.some(s => s.includes('extreme') || s.includes('severe'))) return 'elevated'
    return 'watch'
  }
  if (key === 'usgs' || key === 'wildfire') {
    return Number(data?.count ?? data?.events?.length ?? 0) > 0 ? 'watch' : 'clear'
  }
  if (key === 'aqi') {
    const aqi = Number(data?.us_aqi)
    if (!Number.isFinite(aqi)) return 'neutral'
    if (aqi >= 151) return 'elevated'
    if (aqi >= 101) return 'watch'
    return 'clear'
  }
  if (key === 'epa') {
    return data?.summary && !/no |none|0 /i.test(data.summary) ? 'watch' : 'clear'
  }
  return 'neutral'
}

function toneLabel(tone) {
  if (tone === 'clear') return 'Clear'
  if (tone === 'watch') return 'Watch'
  if (tone === 'elevated') return 'Elevated'
  if (tone === 'error') return 'Unavailable'
  return 'Reported'
}

function primaryMetrics(key, data) {
  const metrics = []
  if (key === 'fema') {
    if (data.zone != null) metrics.push({ label: 'Zone', value: String(data.zone) })
    if (data.sfha != null) metrics.push({ label: 'SFHA', value: data.sfha ? 'Yes' : 'No' })
    if (data.subtype) metrics.push({ label: 'Subtype', value: String(data.subtype) })
  } else if (key === 'aqi') {
    if (data.us_aqi != null) metrics.push({ label: 'US AQI', value: String(data.us_aqi) })
    if (data.pm2_5 != null) metrics.push({ label: 'PM2.5', value: String(data.pm2_5) })
  } else if (data.count != null) {
    metrics.push({ label: 'Count', value: String(data.count) })
  }

  for (const [k, v] of Object.entries(data ?? {})) {
    if (SKIP_KEYS.has(k)) continue
    const formatted = formatScalar(v)
    if (!formatted) continue
    metrics.push({ label: formatKey(k), value: formatted })
  }
  return metrics.slice(0, 6)
}

function EventList({ items, kind }) {
  if (!Array.isArray(items) || !items.length) return null

  return (
    <ul className="hazards-board__events">
      {items.slice(0, 6).map((item, i) => {
        if (kind === 'alerts') {
          return (
            <li key={i} className="hazards-board__event">
              <p className="hazards-board__event-title">{item.event || 'Alert'}</p>
              {item.severity ? (
                <p className="hazards-board__event-meta">{item.severity}</p>
              ) : null}
              {item.headline ? (
                <p className="hazards-board__event-body">{item.headline}</p>
              ) : null}
            </li>
          )
        }
        if (item.magnitude != null) {
          return (
            <li key={i} className="hazards-board__event">
              <p className="hazards-board__event-title">
                M{item.magnitude}
                {item.place ? ` · ${item.place}` : ''}
              </p>
            </li>
          )
        }
        return (
          <li key={i} className="hazards-board__event">
            <p className="hazards-board__event-title">{item.title || 'Event'}</p>
            {item.distance_km != null ? (
              <p className="hazards-board__event-meta">{item.distance_km} km away</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function HazardCard({ hazardKey, data }) {
  const meta = HAZARD_META[hazardKey] ?? { label: formatKey(hazardKey), agency: 'Hazard' }
  const tone = toneForHazard(hazardKey, data)
  const metrics = primaryMetrics(hazardKey, data)
  const summary = data?.summary || data?.error || 'No summary available.'

  return (
    <article className={`hazards-board__card hazards-board__card--${tone}`}>
      <header className="hazards-board__card-head">
        <div className="hazards-board__card-titles">
          <p className="hazards-board__agency">{meta.agency}</p>
          <h3 className="hazards-board__title">{meta.label}</h3>
        </div>
        <span className={`hazards-board__tone hazards-board__tone--${tone}`}>{toneLabel(tone)}</span>
      </header>

      <p className="hazards-board__summary">{summary}</p>

      {metrics.length > 0 ? (
        <dl className="hazards-board__metrics">
          {metrics.map(metric => (
            <div key={`${metric.label}-${metric.value}`} className="hazards-board__metric">
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <EventList items={data?.alerts} kind="alerts" />
      <EventList items={data?.events} kind="events" />
    </article>
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
    <div className="hazards-board">
      <div className="hazards-board__scroll sleek-scrollbar">
        <div
          className="hazards-board__track"
          style={{ '--hazards-cols': String(Math.max(entries.length, 1)) }}
        >
          {entries.map(([key, data]) => (
            <HazardCard key={key} hazardKey={key} data={data} />
          ))}
        </div>
      </div>
    </div>
  )
}
