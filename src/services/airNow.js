import { airNowApiUrl, defaultFetchHeaders } from '../utils/apiBase'
import { distanceMiles } from '../utils/geo'
import { COUNTRY_BBOX, getScopeBbox, getScopeCenter, pointInBbox } from '../utils/scopeBbox'
import { getRiskCache, setRiskCache, riskCacheKey } from '../utils/riskCache'

const OPEN_METEO_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const GRID_COLS = 6
const GRID_ROWS = 4

function aqiSeverity(aqi) {
  const value = Number(aqi)
  if (!Number.isFinite(value)) return 'live'
  if (value >= 151) return 'critical'
  if (value >= 101) return 'watch'
  if (value >= 51) return 'live'
  return 'stable'
}

function countryForPoint(lat, lng, scopeConfig) {
  const preferred = scopeConfig?.countryId
  if (preferred && COUNTRY_BBOX[preferred] && pointInBbox(lat, lng, COUNTRY_BBOX[preferred])) {
    return preferred
  }
  for (const [id, bbox] of Object.entries(COUNTRY_BBOX)) {
    if (pointInBbox(lat, lng, bbox)) return id
  }
  return null
}

function observationToRiskEvent({ lat, lng, aqi, pm25, label, source, provider, scopeConfig }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const aqiValue = Number(aqi)
  const id = `${provider}-${lat.toFixed(3)}-${lng.toFixed(3)}`

  const detailParts = [
    Number.isFinite(aqiValue) ? `US AQI ${Math.round(aqiValue)}` : null,
    pm25 != null ? `PM2.5 ${Number(pm25).toFixed(1)} µg/m³` : null,
  ].filter(Boolean)

  if (provider === 'openmeteo') {
    detailParts.push('Modeled grid sample (Open-Meteo)')
  }

  return {
    id,
    source,
    layer: 'environment',
    geometryType: 'point',
    lat,
    lng,
    country: countryForPoint(lat, lng, scopeConfig),
    label,
    title: Number.isFinite(aqiValue) ? `AQI ${Math.round(aqiValue)}` : 'Air quality sample',
    severity: aqiSeverity(aqiValue),
    timestamp: new Date().toISOString(),
    confidence: provider === 'airnow' ? 95 : 75,
    detail: detailParts.join(' · '),
    dataSources: ['epa'],
    raw: { aqi: aqiValue, pm25, lat, lng, provider },
    links: {
      official:
        provider === 'airnow'
          ? 'https://www.airnow.gov/'
          : 'https://open-meteo.com/en/docs/air-quality-api',
    },
  }
}

function sampleGrid(bbox, cols = GRID_COLS, rows = GRID_ROWS) {
  const points = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const lat = bbox.south + ((bbox.north - bbox.south) * (row + 0.5)) / rows
      const lng = bbox.west + ((bbox.east - bbox.west) * (col + 0.5)) / cols
      points.push({ lat, lng })
    }
  }
  return points
}

function filterPointsForScope(points, scopeConfig) {
  const { scope, userLocation, radiusMiles = 50 } = scopeConfig
  const bbox = getScopeBbox(scopeConfig)

  return points.filter(({ lat, lng }) => {
    if (!pointInBbox(lat, lng, bbox)) return false
    if (scope === 'local' && userLocation) {
      return distanceMiles(userLocation, { lat, lng }) <= radiusMiles
    }
    return true
  })
}

async function fetchOpenMeteoAirQuality(scopeConfig, options = {}) {
  const bbox = getScopeBbox(scopeConfig)
  const points = filterPointsForScope(sampleGrid(bbox), scopeConfig)
  if (points.length === 0) {
    return { events: [], requestUrl: OPEN_METEO_URL, totalFetched: 0, provider: 'openmeteo' }
  }

  const latitudes = points.map(p => p.lat.toFixed(4)).join(',')
  const longitudes = points.map(p => p.lng.toFixed(4)).join(',')
  const url = `${OPEN_METEO_URL}?latitude=${latitudes}&longitude=${longitudes}&current=us_aqi,pm2_5`

  const res = await fetch(url, { signal: options.signal })
  if (!res.ok) throw new Error(`Open-Meteo air quality error (${res.status})`)

  const data = await res.json()
  const events = []

  if (Array.isArray(data)) {
    data.forEach(entry => {
      const lat = Number(entry.latitude)
      const lng = Number(entry.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const aqi = entry.current?.us_aqi
      const pm25 = entry.current?.pm2_5
      const event = observationToRiskEvent({
        lat,
        lng,
        aqi,
        pm25,
        label: `AQI ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
        source: 'Open-Meteo',
        provider: 'openmeteo',
        scopeConfig,
      })
      if (event) events.push(event)
    })
  } else {
    const aqi = data.current?.us_aqi
    const pm25 = data.current?.pm2_5
    const center = getScopeCenter(scopeConfig)
    const lat = Number(data.latitude) || center.lat
    const lng = Number(data.longitude) || center.lng
    const event = observationToRiskEvent({
      lat,
      lng,
      aqi,
      pm25,
      label: `AQI ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
      source: 'Open-Meteo',
      provider: 'openmeteo',
      scopeConfig,
    })
    if (event) events.push(event)
  }

  return {
    events,
    requestUrl: url,
    totalFetched: events.length,
    provider: 'openmeteo',
  }
}

async function fetchAirNowObservations(scopeConfig, apiKey, options = {}) {
  const center = getScopeCenter(scopeConfig)
  const distance =
    scopeConfig.scope === 'local'
      ? Math.min(scopeConfig.radiusMiles ?? 50, 100)
      : scopeConfig.scope === 'national'
        ? 250
        : 500

  const path = `/aq/observation/latLong/current/?format=application/json&latitude=${center.lat}&longitude=${center.lng}&distance=${distance}&API_KEY=${encodeURIComponent(apiKey)}`
  const url = airNowApiUrl(path)

  const res = await fetch(url, { headers: defaultFetchHeaders(), signal: options.signal })
  if (!res.ok) throw new Error(`EPA AirNow API error (${res.status})`)

  const data = await res.json()
  const observations = Array.isArray(data) ? data : []

  const events = observations
    .map(obs => {
      const lat = parseFloat(obs.Latitude)
      const lng = parseFloat(obs.Longitude)
      const aqi = obs.AQI ?? obs['PM2.5'] ?? obs.Ozone
      const category = obs.Category?.Name
      const event = observationToRiskEvent({
        lat,
        lng,
        aqi,
        pm25: obs['PM2.5'],
        label: obs.SiteName ?? obs.ReportingArea ?? 'AirNow station',
        source: 'EPA AirNow',
        provider: 'airnow',
        scopeConfig,
      })
      if (event && category) {
        event.detail = `${event.detail} · ${category}`
      }
      return event
    })
    .filter(Boolean)
    .filter(e => filterPointsForScope([{ lat: e.lat, lng: e.lng }], scopeConfig).length > 0)

  return {
    events,
    requestUrl: url.replace(apiKey, '***'),
    totalFetched: events.length,
    provider: 'airnow',
  }
}

export async function fetchAirNow(scopeConfig, options = {}) {
  const apiKey = import.meta.env.VITE_AIRNOW_API_KEY?.trim()
  const provider = apiKey ? 'airnow' : 'openmeteo'

  const cacheKey = riskCacheKey([
    'v2',
    provider,
    scopeConfig.scope,
    scopeConfig.countryId,
    scopeConfig.userLocation?.lat,
    scopeConfig.userLocation?.lng,
    scopeConfig.radiusMiles,
  ])

  if (!options.skipCache) {
    const cached = getRiskCache('airnow', cacheKey)
    if (cached) return { ...cached, fromCache: true }
  }

  const result = apiKey
    ? await fetchAirNowObservations(scopeConfig, apiKey, options)
    : await fetchOpenMeteoAirQuality(scopeConfig, options)

  const payload = { ...result, missingApiKey: !apiKey, usingFallback: !apiKey }
  setRiskCache('airnow', cacheKey, payload)
  return payload
}

export function airNowToSignals(markers, limit = 6) {
  return [...markers]
    .sort((a, b) => {
      const rank = { critical: 0, watch: 1, live: 2, stable: 3 }
      const aqiA = a.raw?.aqi ?? 0
      const aqiB = b.raw?.aqi ?? 0
      return (rank[a.severity] ?? 4) - (rank[b.severity] ?? 4) || aqiB - aqiA
    })
    .slice(0, limit)
    .map(marker => ({
      id: `airnow-signal-${marker.id}`,
      severity: marker.severity,
      title: marker.title,
      source: marker.source ?? 'EPA AirNow',
      dataSources: ['epa'],
      confidence: marker.confidence,
      action: marker.action,
      markerId: marker.id,
      live: true,
    }))
}
