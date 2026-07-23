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

function FieldCard({ label, value }) {
  return (
    <li className="rounded border border-panel-border bg-panel-surface/60 px-2.5 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="dossier-value mt-1 font-mono text-[11px] leading-snug">{value}</p>
    </li>
  )
}

function EventList({ items, kind }) {
  if (!Array.isArray(items) || !items.length) return null

  return (
    <ul className="mt-2 space-y-1.5">
      {items.slice(0, 5).map((item, i) => {
        if (kind === 'alerts') {
          return (
            <li
              key={i}
              className="rounded border border-panel-border border-l-[3px] border-l-command-watch/70 bg-panel-surface/40 px-2.5 py-2"
            >
              <p className="font-mono text-[11px] leading-snug text-ink-primary">
                {item.event || 'Alert'}
              </p>
              {item.severity ? (
                <p className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-ink-faint">
                  {item.severity}
                </p>
              ) : null}
              {item.headline ? (
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-secondary">
                  {item.headline}
                </p>
              ) : null}
            </li>
          )
        }
        if (item.magnitude != null) {
          return (
            <li
              key={i}
              className="rounded border border-panel-border bg-panel-surface/60 px-2.5 py-2"
            >
              <p className="font-mono text-[11px] leading-snug text-ink-primary">
                M{item.magnitude}
                {item.place ? ` · ${item.place}` : ''}
              </p>
            </li>
          )
        }
        return (
          <li
            key={i}
            className="rounded border border-panel-border bg-panel-surface/60 px-2.5 py-2"
          >
            <p className="font-mono text-[11px] leading-snug text-ink-primary">
              {item.title || 'Event'}
            </p>
            {item.distance_km != null ? (
              <p className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-ink-faint">
                {item.distance_km} km away
              </p>
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
    <div className="mt-3 border-t border-panel-border/60 pt-3">
      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-command-watch">
        Location seismic analysis · 5Y · M2.5+
      </p>

      {analysis.status === 'loading' ? (
        <div className="mt-2 flex items-center gap-2" role="status" aria-live="polite">
          <span className="street-view-spinner h-2.5 w-2.5 shrink-0" aria-hidden />
          <span className="font-mono text-[9px] text-ink-muted">Running analysis in background…</span>
        </div>
      ) : null}

      {analysis.status === 'error' ? (
        <p className="mt-2 font-mono text-[9px] text-ink-faint">{analysis.error}</p>
      ) : null}

      {analysis.status === 'ready' ? (
        <ul className="mt-2 space-y-1.5">
          <FieldCard label={`Events within ${ANALYSIS_RADIUS_MI} mi`} value={String(totalEvents ?? 0)} />
          <FieldCard
            label="Rate per year"
            value={ratePerYear != null ? ratePerYear.toFixed(1) : '-'}
          />
          <FieldCard
            label="Strongest event"
            value={
              maxEvent
                ? `M${Number(maxEvent.mag).toFixed(1)} · ${Math.round(maxEvent.dist)} mi`
                : 'None in range'
            }
          />
          {analysis.cumulative.map(band => (
            <FieldCard
              key={band.radius}
              label={`Within ${band.radius} mi`}
              value={`${band.count}${band.ratePerYear != null ? ` · ${band.ratePerYear.toFixed(1)}/yr` : ''}`}
            />
          ))}
        </ul>
      ) : null}

      {analysisHref ? (
        <Link to={analysisHref} className="dossier-link mt-3 inline-flex items-center gap-1 font-mono text-[10px]">
          Open full Seismic/EQ Analysis
          <span aria-hidden>↗</span>
        </Link>
      ) : null}
    </div>
  )
}

function HazardColumn({ hazardKey, data, lat, lng, label }) {
  const meta = HAZARD_META[hazardKey] ?? { label: formatKey(hazardKey), agency: 'Hazard' }
  const fields = primaryFields(hazardKey, data)
  const summary = data?.error || data?.summary || null
  const isUsgs = hazardKey === 'usgs'

  return (
    <section className="cope-runway__column flex min-w-0 flex-col border-panel-border/60">
      <header className="cope-runway__header shrink-0 px-3 py-3">
        <p className="cope-runway__count font-mono text-[8px] uppercase tracking-[0.14em]">
          {meta.agency}
        </p>
        <p className="mt-1 font-display text-sm font-semibold tracking-[0.04em]">
          <span className="cope-runway__label text-[11px] font-medium uppercase tracking-[0.14em]">
            {meta.label}
          </span>
        </p>
      </header>

      <div className="cope-runway__column-body px-2.5 py-2.5">
        {summary ? (
          <p className="mb-2 font-mono text-[10px] leading-relaxed text-ink-secondary">{summary}</p>
        ) : null}

        {fields.length > 0 ? (
          <ul className="space-y-1.5">
            {fields.map(field => (
              <FieldCard key={`${field.label}-${field.value}`} label={field.label} value={field.value} />
            ))}
          </ul>
        ) : null}

        <EventList items={data?.alerts} kind="alerts" />
        <EventList items={data?.events} kind="events" />

        {isUsgs ? <SeismicAnalysisBlock lat={lat} lng={lng} label={label} /> : null}

        {!summary && !fields.length && !data?.alerts?.length && !data?.events?.length && !isUsgs ? (
          <p className="px-1 py-2 font-mono text-[9px] leading-relaxed text-ink-faint">
            No observations from this source.
          </p>
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
    <div className="cope-runway border-b border-panel-border">
      <div className="cope-runway__scroll">
        <div
          className="cope-runway__track grid divide-x divide-[color:var(--dossier-border,#d6d6d2)]"
          style={{
            gridTemplateColumns: `repeat(${Math.max(entries.length, 1)}, minmax(16.5rem, 1fr))`,
            minWidth: `max(100%, calc(${Math.max(entries.length, 1)} * 16.5rem))`,
          }}
        >
          {entries.map(([key, data]) => (
            <HazardColumn
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
