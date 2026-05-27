import { firmsApiUrl } from '../utils/apiBase'
import { getScopeBbox, bboxToFirmsArea, pointInBbox } from '../utils/scopeBbox'
import { getRiskCache, setRiskCache, riskCacheKey } from '../utils/riskCache'

const FIRMS_SOURCE = 'VIIRS_SNPP_NRT'
const DAY_RANGE = 1

function parseCsv(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = line.split(',')
    const row = {}
    headers.forEach((h, i) => {
      row[h] = values[i]?.trim()
    })
    return row
  })
}

function brightnessSeverity(brightness) {
  const b = Number(brightness)
  if (!Number.isFinite(b)) return 'live'
  if (b >= 400) return 'critical'
  if (b >= 350) return 'watch'
  return 'live'
}

function rowToRiskEvent(row) {
  const lat = parseFloat(row.latitude)
  const lng = parseFloat(row.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const id = `firms-${row.latitude}-${row.longitude}-${row.acq_date ?? ''}-${row.acq_time ?? ''}`
  const conf = row.confidence ? `${row.confidence}%` : 'n/a'

  return {
    id,
    source: 'NASA',
    layer: 'wildfire',
    geometryType: 'point',
    lat,
    lng,
    country: lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65 ? 'US' : null,
    label: `FIRMS-${lat.toFixed(2)},${lng.toFixed(2)}`,
    title: `Fire hotspot · ${row.acq_date ?? 'recent'}`,
    severity: brightnessSeverity(row.bright_ti4 ?? row.brightness),
    timestamp: row.acq_date,
    confidence: row.confidence === 'h' ? 95 : row.confidence === 'n' ? 70 : 85,
    detail: [
      `Brightness ${row.bright_ti4 ?? row.brightness ?? 'n/a'}`,
      `Confidence ${conf}`,
      row.frp ? `FRP ${row.frp} MW` : null,
      `Acquired ${row.acq_date ?? ''} ${row.acq_time ?? ''} UTC`,
    ]
      .filter(Boolean)
      .join(' · '),
    dataSources: ['nasa'],
    raw: row,
    links: {
      official: 'https://firms.modaps.eosdis.nasa.gov/map/',
    },
  }
}

export function buildFirmsRequestUrl(scopeConfig) {
  const key = import.meta.env.VITE_NASA_FIRMS_MAP_KEY
  const bbox = getScopeBbox(scopeConfig)
  const area = bboxToFirmsArea(bbox)
  return firmsApiUrl(`/api/area/csv/${key}/${FIRMS_SOURCE}/${area}/${DAY_RANGE}`)
}

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=120'

function eonetEventToRiskEvent(evt) {
  const geometries = evt.geometry ?? []
  const latest = geometries[geometries.length - 1]
  if (!latest || latest.type !== 'Point' || !latest.coordinates) return null

  const [lng, lat] = latest.coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const acres = latest.magnitudeUnit === 'acres' ? latest.magnitudeValue : null
  const severity = acres != null && acres >= 1000 ? 'critical' : acres != null && acres >= 100 ? 'watch' : 'live'

  return {
    id: `eonet-${evt.id}`,
    source: 'NASA',
    layer: 'wildfire',
    geometryType: 'point',
    lat,
    lng,
    country: lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65 ? 'US' : null,
    label: evt.id,
    title: evt.title ?? 'Active wildfire',
    severity,
    timestamp: latest.date,
    confidence: 88,
    detail: [
      evt.description,
      acres != null ? `${acres} acres` : null,
      latest.date ? `Updated ${new Date(latest.date).toLocaleString()}` : null,
      'NASA EONET (add VITE_NASA_FIRMS_MAP_KEY for FIRMS hotspots)',
    ]
      .filter(Boolean)
      .join(' · '),
    dataSources: ['nasa'],
    raw: evt,
    links: { official: evt.link ?? 'https://eonet.gsfc.nasa.gov/' },
  }
}

async function fetchEonetWildfires(scopeConfig, options = {}) {
  const bbox = getScopeBbox(scopeConfig)
  const res = await fetch(EONET_URL, { signal: options.signal })
  if (!res.ok) throw new Error(`NASA EONET API error (${res.status})`)

  const data = await res.json()
  const events = (data.events ?? [])
    .map(eonetEventToRiskEvent)
    .filter(Boolean)
    .filter(e => pointInBbox(e.lat, e.lng, bbox))

  return {
    events,
    requestUrl: EONET_URL,
    totalFetched: events.length,
    provider: 'eonet',
  }
}

async function fetchFirmsArea(scopeConfig, options = {}) {
  const url = buildFirmsRequestUrl(scopeConfig)
  const res = await fetch(url, { signal: options.signal })
  if (!res.ok) throw new Error(`NASA FIRMS API error (${res.status})`)

  const text = await res.text()
  const rows = parseCsv(text)
  const events = rows.map(rowToRiskEvent).filter(Boolean)

  return {
    events,
    requestUrl: url,
    totalFetched: events.length,
    provider: 'firms',
  }
}

export async function fetchNasaFirms(scopeConfig, options = {}) {
  const mapKey = import.meta.env.VITE_NASA_FIRMS_MAP_KEY?.trim()
  const provider = mapKey ? 'firms' : 'eonet'

  const cacheKey = riskCacheKey([
    provider,
    scopeConfig.scope,
    scopeConfig.countryId,
    scopeConfig.userLocation?.lat,
    scopeConfig.radiusMiles,
    DAY_RANGE,
  ])

  if (!options.skipCache) {
    const cached = getRiskCache('firms', cacheKey)
    if (cached) return { ...cached, fromCache: true }
  }

  const result = mapKey
    ? await fetchFirmsArea(scopeConfig, options)
    : await fetchEonetWildfires(scopeConfig, options)

  const payload = { ...result, missingApiKey: false, usingFallback: !mapKey }
  setRiskCache('firms', cacheKey, payload)
  return payload
}

export function firmsToSignals(markers, limit = 6) {
  return [...markers]
    .slice(0, limit)
    .map(marker => ({
      id: `firms-signal-${marker.id}`,
      severity: marker.severity,
      title: marker.title,
      source: 'NASA FIRMS',
      dataSources: ['nasa'],
      confidence: marker.confidence,
      action: marker.action,
      markerId: marker.id,
      live: true,
    }))
}
