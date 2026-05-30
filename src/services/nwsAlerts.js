import { defaultFetchHeaders, nwsApiUrl } from '../utils/apiBase'
import { geometryCentroid, pointInPolygon } from '../utils/geo'
import { getScopeBbox, bboxIntersects } from '../utils/scopeBbox'
import { getRiskCache, setRiskCache, riskCacheKey } from '../utils/riskCache'

const MAX_ALERTS = 500

function alertSeverity(event) {
  const sev = (event ?? '').toLowerCase()
  if (sev === 'extreme') return 'critical'
  if (sev === 'severe') return 'watch'
  if (sev === 'moderate' || sev === 'minor') return 'live'
  return 'stable'
}

function featureBbox(geometry) {
  if (!geometry?.coordinates) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  const visit = coords => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords
      west = Math.min(west, lng)
      east = Math.max(east, lng)
      south = Math.min(south, lat)
      north = Math.max(north, lat)
      return
    }
    coords.forEach(visit)
  }

  visit(geometry.coordinates)
  if (!Number.isFinite(west)) return null
  return { west, south, east, north }
}

function nwsOfficialLink(props) {
  const ugc = props?.geocode?.UGC?.[0] ?? props?.geocode?.ugc?.[0]
  if (ugc) {
    return `https://forecast.weather.gov/MapClick.php?zone=${encodeURIComponent(ugc)}`
  }
  return 'https://www.weather.gov/warnings'
}

function featureToRiskEvent(feature, userLocation) {
  const props = feature.properties ?? {}
  const geometry = feature.geometry
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return null

  const id = props.id ?? props['@id'] ?? `nws-${props.event ?? 'alert'}-${props.sent ?? Date.now()}`
  const centroid = geometryCentroid(geometry)
  if (!centroid) return null

  const containsUser =
    userLocation && pointInPolygon({ lng: userLocation.lng, lat: userLocation.lat }, geometry)

  return {
    id: String(id).replace(/[^a-zA-Z0-9-_]/g, '_'),
    source: 'NWS',
    layer: 'weather',
    geometryType: 'polygon',
    polygon: geometry,
    centroidLat: centroid.lat,
    centroidLng: centroid.lng,
    lat: centroid.lat,
    lng: centroid.lng,
    country: 'US',
    label: `NWS-${props.event ?? 'ALERT'}`,
    title: props.event ?? 'Weather Alert',
    severity: alertSeverity(props.severity),
    timestamp: props.sent ?? props.effective,
    confidence: 100,
    detail: [
      props.headline,
      props.areaDesc,
      props.severity ? `Severity: ${props.severity}` : null,
      props.urgency ? `Urgency: ${props.urgency}` : null,
      containsUser ? 'Your location is inside this warning area' : null,
    ]
      .filter(Boolean)
      .join(' · '),
    dataSources: ['nws'],
    raw: props,
    links: { official: nwsOfficialLink(props) },
  }
}

export function buildNwsRequestUrl() {
  return nwsApiUrl('/alerts/active?status=actual')
}

export async function fetchNwsAlerts(scopeConfig, options = {}) {
  const bbox = getScopeBbox(scopeConfig)
  const cacheKey = riskCacheKey([
    scopeConfig.scope,
    scopeConfig.countryId,
    scopeConfig.userLocation?.lat,
    scopeConfig.userLocation?.lng,
    scopeConfig.radiusMiles,
  ])

  if (!options.skipCache) {
    const cached = getRiskCache('nws', cacheKey)
    if (cached) return { ...cached, fromCache: true }
  }

  const url = buildNwsRequestUrl()
  const res = await fetch(url, { headers: defaultFetchHeaders(), signal: options.signal })
  if (!res.ok) throw new Error(`NWS API error (${res.status})`)

  const data = await res.json()
  const features = (data.features ?? []).slice(0, MAX_ALERTS * 2)

  const events = []
  for (const feature of features) {
    const fb = featureBbox(feature.geometry)
    if (fb && !bboxIntersects(bbox, fb)) continue
    const event = featureToRiskEvent(feature, scopeConfig.userLocation)
    if (event) events.push(event)
    if (events.length >= MAX_ALERTS) break
  }

  const result = { events, requestUrl: url, totalFetched: events.length }
  setRiskCache('nws', cacheKey, result)
  return result
}

export function nwsToSignals(zoneMarkers, limit = 6) {
  return [...zoneMarkers]
    .sort((a, b) => {
      const rank = { critical: 0, watch: 1, live: 2, stable: 3 }
      return (rank[a.severity] ?? 4) - (rank[b.severity] ?? 4)
    })
    .slice(0, limit)
    .map(marker => ({
      id: `nws-signal-${marker.id}`,
      severity: marker.severity,
      layer: marker.layer ?? 'weather',
      title: marker.title,
      source: 'NWS api.weather.gov',
      dataSources: ['nws'],
      confidence: marker.confidence,
      action: marker.action,
      markerId: marker.id,
      timestamp: marker.timestamp ?? null,
      live: true,
    }))
}
