import { fetchAllUsgsFeatures } from '../utils/fetchPaginated'
import { COUNTRIES } from '../data/commandMapData'
import { COUNTRY_BBOX, pointInBbox } from '../utils/scopeBbox'

const USGS_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
const LOOKBACK_DAYS = 30

/** USGS FDSNWS bbox query params (min/max lat/lng). */
const USGS_COUNTRY_BBOX = {
  US: { minlatitude: 18, maxlatitude: 72, minlongitude: -180, maxlongitude: -65 },
  CA: { minlatitude: 41, maxlatitude: 84, minlongitude: -141, maxlongitude: -52 },
  MX: { minlatitude: 14, maxlatitude: 33, minlongitude: -118, maxlongitude: -86 },
  GB: { minlatitude: 49, maxlatitude: 61, minlongitude: -11, maxlongitude: 2 },
  DE: { minlatitude: 47, maxlatitude: 55, minlongitude: 5, maxlongitude: 16 },
  AU: { minlatitude: -44, maxlatitude: -10, minlongitude: 112, maxlongitude: 154 },
  JP: { minlatitude: 24, maxlatitude: 46, minlongitude: 122, maxlongitude: 146 },
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function magnitudeSeverity(mag) {
  if (mag == null) return 'stable'
  if (mag >= 6) return 'critical'
  if (mag >= 5) return 'watch'
  if (mag >= 3) return 'live'
  return 'stable'
}

function buildQueryParams({ scope, userLocation, radiusMiles, countryId, minMagnitude = 2.5 }, pagination = {}) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - LOOKBACK_DAYS)

  const params = {
    format: 'geojson',
    starttime: formatDate(start),
    endtime: formatDate(end),
    orderby: 'time',
  }

  if (pagination.limit != null) params.limit = pagination.limit
  if (pagination.offset != null && pagination.offset >= 1) params.offset = pagination.offset

  if (scope === 'local' && userLocation) {
    params.latitude = userLocation.lat
    params.longitude = userLocation.lng
    params.maxradiuskm = Math.round(radiusMiles * 1.60934)
  } else if (scope === 'national') {
    const bbox = USGS_COUNTRY_BBOX[countryId]
    if (bbox) {
      Object.assign(params, bbox)
    } else {
      const country = COUNTRIES.find(c => c.id === countryId)
      if (country) {
        params.latitude = country.center[1]
        params.longitude = country.center[0]
        params.maxradiuskm = 1500
      }
    }
  }

  params.minmagnitude = minMagnitude

  return params
}

function featureToMarker(feature) {
  const [lng, lat, depth] = feature.geometry.coordinates
  const props = feature.properties
  const mag = props.mag
  const code = props.code ?? props.ids?.split(',')[0] ?? 'unknown'
  const id = `usgs-${code}`

  let country = null
  for (const [id, bbox] of Object.entries(COUNTRY_BBOX)) {
    if (pointInBbox(lat, lng, bbox)) {
      country = id
      break
    }
  }

  const pointRadius = Math.max(4, Math.min(14, (mag ?? 2.5) * 1.6))

  return {
    id,
    lng,
    lat,
    depth,
    country,
    label: `USGS-${code}`,
    layer: 'earthquake',
    dataSources: ['usgs'],
    severity: magnitudeSeverity(mag),
    title: mag != null ? `M${mag.toFixed(1)} — ${props.place}` : props.place,
    detail: [
      props.mag != null ? `Magnitude ${mag.toFixed(1)}` : 'Magnitude unavailable',
      `Depth ${depth?.toFixed(1) ?? '?'} km`,
      `Recorded ${new Date(props.time).toLocaleString()}`,
      props.alert ? `Alert level: ${props.alert}` : null,
      props.tsunami === 1 ? 'Tsunami flag issued' : null,
    ]
      .filter(Boolean)
      .join(' · '),
    source: 'USGS Earthquake Hazards',
    confidence: 100,
    action: props.url ? 'Open official USGS event page' : 'Monitor USGS catalog',
    usgsUrl: props.url,
    live: true,
    mag,
    time: props.time,
    pointRadius,
  }
}

export function buildUsgsRequestUrl(scopeConfig, pagination = { limit: 2000 }) {
  const params = buildQueryParams(scopeConfig, pagination)
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  )
  return `${USGS_ENDPOINT}?${query}`
}

export async function fetchUsgsEarthquakes(scopeConfig, options = {}) {
  if (scopeConfig.scope === 'local' && !scopeConfig.userLocation) {
    return { markers: [], requestUrl: null, totalFetched: 0 }
  }

  const buildUrl = pagination => buildUsgsRequestUrl(scopeConfig, pagination)
  const requestUrl = buildUsgsRequestUrl(scopeConfig, { limit: 2000 })

  const features = await fetchAllUsgsFeatures(buildUrl, { signal: options.signal })
  let markers = features.map(featureToMarker)

  if (scopeConfig.scope === 'national') {
    const bbox = COUNTRY_BBOX[scopeConfig.countryId]
    if (bbox) {
      markers = markers.filter(m => pointInBbox(m.lat, m.lng, bbox))
    }
  }

  return { markers, requestUrl, totalFetched: features.length }
}

export function earthquakesToSignals(markers, limit = 6) {
  return [...markers]
    .sort((a, b) => (b.mag ?? 0) - (a.mag ?? 0))
    .slice(0, limit)
    .map(marker => ({
      id: `usgs-signal-${marker.id}`,
      severity: marker.severity,
      layer: marker.layer,
      title: marker.title,
      source: 'USGS FDSNWS',
      dataSources: ['usgs'],
      confidence: 100,
      action: marker.action,
      markerId: marker.id,
      live: true,
    }))
}
