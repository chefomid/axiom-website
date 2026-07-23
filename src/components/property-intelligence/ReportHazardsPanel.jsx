import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { earthquakeAnalysisAtLocation } from '../../constants/routes'
import { ANALYTICS_RADIUS_BREAKPOINTS } from '../../data/commandMapData'
import { fetchUsgsEarthquakeHistory } from '../../services/usgsEarthquakes'
import {
  computeEarthquakeAnalytics,
  dateRangeForYears,
} from '../../utils/earthquakeAnalytics'
import { USGS_CATALOG_MIN_MAGNITUDE } from '../../utils/earthquakeMagnitude'

const HAZARD_META = {
  fema: { label: 'FEMA flood', agency: 'NFHL' },
  nws: { label: 'NWS alerts', agency: 'Weather' },
  usgs: { label: 'USGS seismic', agency: 'Earthquake' },
  wildfire: { label: 'Wildfire', agency: 'NASA EONET' },
  aqi: { label: 'Air quality', agency: 'Open-Meteo' },
  epa: { label: 'EPA ECHO', agency: 'Facilities' },
}

const SKIP_KEYS = new Set([
  'summary',
  'error',
  'alerts',
  'events',
  'zone',
  'sfha',
  'subtype',
  'count',
  'us_aqi',
  'pm2_5',
])

const ANALYSIS_YEARS = 5
const ANALYSIS_RADIUS_MI = 100
const ANALYSIS_BREAKPOINTS = ANALYTICS_RADIUS_BREAKPOINTS.filter(mi => mi <= ANALYSIS_RADIUS_MI)
const SNAPSHOT_RADII = [25, 50, 100]

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

function primaryFields(key, data) {
  const fields = []
  if (key === 'fema') {
    if (data.zone != null) fields.push({ label: 'Zone', value: String(data.zone) })
    if (data.sfha != null) fields.push({ label: 'SFHA', value: data.sfha ? 'Yes' : 'No' })
    if (data.subtype) fields.push({ label: 'Subtype', value: String(data.subtype) })
  } else if (key === 'aqi') {
    if (data.us_aqi != null) fields.push({ label: 'US AQI', value: String(data.us_aqi) })
    if (data.pm2_5 != null) fields.push({ label: 'PM2.5', value: String(data.pm2_5) })
  } else if (data.count != null) {
    fields.push({ label: 'Count', value: String(data.count) })
  }

  for (const [k, v] of Object.entries(data ?? {})) {
    if (SKIP_KEYS.has(k)) continue
    const formatted = formatScalar(v)
    if (!formatted) continue
    fields.push({ label: formatKey(k), value: formatted })
  }
  return fields.slice(0, 8)
}

function EventList({ items, kind }) {
  if (!Array.isArray(items) || !items.length) return null

  return (
    <ul className="hazards-rail__events">
      {items.slice(0, 5).map((item, i) => {
        if (kind === 'alerts') {
          return (
            <li key={i} className="hazards-rail__event">
              <p className="hazards-rail__event-title">{item.event || 'Alert'}</p>
              {item.severity ? (
                <p className="hazards-rail__event-meta">{item.severity}</p>
              ) : null}
              {item.headline ? (
                <p className="hazards-rail__event-body">{item.headline}</p>
              ) : null}
            </li>
          )
        }
        if (item.magnitude != null) {
          return (
            <li key={i} className="hazards-rail__event">
              <p className="hazards-rail__event-title">
                M{item.magnitude}
                {item.place ? ` · ${item.place}` : ''}
              </p>
            </li>
          )
        }
        return (
          <li key={i} className="hazards-rail__event">
            <p className="hazards-rail__event-title">{item.title || 'Event'}</p>
            {item.distance_km != null ? (
              <p className="hazards-rail__event-meta">{item.distance_km} km away</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function useLocationSeismicAnalysis(lat, lng, enabled) {
  const [state, setState] = useState({
    status: 'idle',
    summary: null,
    cumulative: [],
    error: null,
  })

  useEffect(() => {
    if (!enabled || lat == null || lng == null) {
      setState({ status: 'idle', summary: null, cumulative: [], error: null })
      return undefined
    }

    const controller = new AbortController()
    const center = { lat: Number(lat), lng: Number(lng) }
    const { startDate, endDate, yearsInRange } = dateRangeForYears(ANALYSIS_YEARS)

    setState(prev => ({ ...prev, status: 'loading', error: null }))

    ;(async () => {
      try {
        const result = await fetchUsgsEarthquakeHistory(
          {
            center,
            maxRadiusMiles: ANALYSIS_RADIUS_MI,
            minMagnitude: USGS_CATALOG_MIN_MAGNITUDE,
            startDate,
            endDate,
          },
          { signal: controller.signal },
        )
        if (controller.signal.aborted) return

        const analytics = computeEarthquakeAnalytics(
          result.events,
          center,
          ANALYSIS_BREAKPOINTS,
          yearsInRange,
        )

        setState({
          status: 'ready',
          summary: analytics.summary,
          cumulative: analytics.cumulative.filter(band => SNAPSHOT_RADII.includes(band.radius)),
          error: null,
        })
      } catch (err) {
        if (err?.name === 'AbortError') return
        setState({
          status: 'error',
          summary: null,
          cumulative: [],
          error: err?.message || 'Seismic analysis unavailable',
        })
      }
    })()

    return () => controller.abort()
  }, [lat, lng, enabled])

  return state
}

function SeismicAnalysisBlock({ lat, lng, label }) {
  const analysis = useLocationSeismicAnalysis(lat, lng, lat != null && lng != null)
  const analysisHref =
    lat != null && lng != null ? earthquakeAnalysisAtLocation(lat, lng, label) : null

  const maxEvent = analysis.summary?.maxEvent
  const totalEvents = analysis.summary?.totalEvents
  const ratePerYear =
    analysis.summary?.yearsInRange > 0 && totalEvents != null
      ? totalEvents / analysis.summary.yearsInRange
      : null

  return (
    <div className="hazards-rail__analysis">
      <p className="hazards-rail__analysis-label">Location seismic analysis · 5Y · M2.5+</p>

      {analysis.status === 'loading' ? (
        <div className="hazards-rail__analysis-status" role="status" aria-live="polite">
          <span className="street-view-spinner h-2.5 w-2.5 shrink-0" aria-hidden />
          <span>Running analysis in background…</span>
        </div>
      ) : null}

      {analysis.status === 'error' ? (
        <p className="hazards-rail__empty">{analysis.error}</p>
      ) : null}

      {analysis.status === 'ready' ? (
        <ul className="hazards-rail__fields">
          <li className="hazards-rail__field">
            <p className="hazards-rail__field-key">Events within {ANALYSIS_RADIUS_MI} mi</p>
            <p className="hazards-rail__field-value dossier-value">{totalEvents ?? 0}</p>
          </li>
          <li className="hazards-rail__field">
            <p className="hazards-rail__field-key">Rate per year</p>
            <p className="hazards-rail__field-value dossier-value">
              {ratePerYear != null ? ratePerYear.toFixed(1) : '-'}
            </p>
          </li>
          <li className="hazards-rail__field">
            <p className="hazards-rail__field-key">Strongest event</p>
            <p className="hazards-rail__field-value dossier-value">
              {maxEvent
                ? `M${Number(maxEvent.mag).toFixed(1)} · ${Math.round(maxEvent.dist)} mi`
                : 'None in range'}
            </p>
          </li>
          {analysis.cumulative.map(band => (
            <li key={band.radius} className="hazards-rail__field">
              <p className="hazards-rail__field-key">Within {band.radius} mi</p>
              <p className="hazards-rail__field-value dossier-value">
                {band.count}
                {band.ratePerYear != null ? ` · ${band.ratePerYear.toFixed(1)}/yr` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {analysisHref ? (
        <Link to={analysisHref} className="hazards-rail__analysis-link dossier-link">
          Open full Seismic/EQ Analysis
          <span aria-hidden> ↗</span>
        </Link>
      ) : null}
    </div>
  )
}

function HazardPanel({ hazardKey, data, lat, lng, label }) {
  const meta = HAZARD_META[hazardKey] ?? { label: formatKey(hazardKey), agency: 'Hazard' }
  const fields = primaryFields(hazardKey, data)
  const summary = data?.error || data?.summary || null
  const isUsgs = hazardKey === 'usgs'

  return (
    <section className="hazards-rail__panel">
      <header className="hazards-rail__panel-head">
        <p className="hazards-rail__agency">{meta.agency}</p>
        <h3 className="hazards-rail__panel-title">{meta.label}</h3>
      </header>

      <div className="hazards-rail__panel-body sleek-scrollbar">
        {summary ? <p className="hazards-rail__summary">{summary}</p> : null}

        {fields.length > 0 ? (
          <ul className="hazards-rail__fields">
            {fields.map(field => (
              <li key={`${field.label}-${field.value}`} className="hazards-rail__field">
                <p className="hazards-rail__field-key">{field.label}</p>
                <p className="hazards-rail__field-value dossier-value">{field.value}</p>
              </li>
            ))}
          </ul>
        ) : null}

        <EventList items={data?.alerts} kind="alerts" />
        <EventList items={data?.events} kind="events" />

        {isUsgs ? <SeismicAnalysisBlock lat={lat} lng={lng} label={label} /> : null}

        {!summary && !fields.length && !data?.alerts?.length && !data?.events?.length && !isUsgs ? (
          <p className="hazards-rail__empty">No observations from this source.</p>
        ) : null}
      </div>
    </section>
  )
}

export default function ReportHazardsPanel({ hazards, lat = null, lng = null, label = null }) {
  const entries = useMemo(
    () => Object.entries(hazards ?? {}).filter(([, data]) => data && typeof data === 'object'),
    [hazards],
  )

  if (!entries.length) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        No hazard payloads returned. Add hazard sources (FEMA, NWS, USGS, etc.) to your package.
      </p>
    )
  }

  return (
    <div className="hazards-rail">
      <div className="hazards-rail__scroll sleek-scrollbar">
        <div
          className="hazards-rail__track"
          style={{ '--hazards-cols': String(Math.max(entries.length, 1)) }}
        >
          {entries.map(([key, data]) => (
            <HazardPanel
              key={key}
              hazardKey={key}
              data={data}
              lat={lat}
              lng={lng}
              label={label}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
