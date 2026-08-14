import { firmsApiUrl } from '../utils/apiBase'
import { getMarkerReportUrl } from '../utils/markerReportUrl'
import { headlineForMarker, locationLabelForMarker } from '../utils/signalLocation'
import { getScopeBbox, pointInBbox } from '../utils/scopeBbox'
import { firmsAreaForScope, parseFirmsCsv } from '../utils/firmsFeed'
import { getLastGoodRiskCache, getRiskCache, setRiskCache, riskCacheKey } from '../utils/riskCache'
import { mergeWildfireEvents } from '../utils/wildfireDisplay'
import { fetchNifcWildfires } from './nifcWildfire'

const FIRMS_SOURCE = 'VIIRS_SNPP_NRT'
const DAY_RANGE = 1
const MAX_HOTSPOTS = 2000

function brightnessSeverity(brightness) {
  const b = Number(brightness)
  if (!Number.isFinite(b)) return 'live'
  if (b >= 400) return 'critical'
  if (b >= 350) return 'watch'
  return 'live'
}

function firmsAcquisitionTimestamp(row) {
  if (!row.acq_date) return null
  if (!row.acq_time) return row.acq_date

  const padded = String(row.acq_time).padStart(4, '0')
  const hours = padded.slice(0, 2)
  const minutes = padded.slice(2, 4)
  return `${row.acq_date}T${hours}:${minutes}:00Z`
}

function rowToRiskEvent(row) {
  const lat = parseFloat(row.latitude)
  const lng = parseFloat(row.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const id = `firms-${row.latitude}-${row.longitude}-${row.acq_date ?? ''}-${row.acq_time ?? ''}`

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
    timestamp: firmsAcquisitionTimestamp(row),
    confidence: row.confidence === 'h' ? 95 : row.confidence === 'n' ? 70 : 85,
    detail: [
      `Brightness ${row.bright_ti4 ?? row.brightness ?? 'n/a'}`,
      row.frp ? `FRP ${row.frp} MW` : null,
      `Acquired ${row.acq_date ?? ''} ${row.acq_time ?? ''} UTC`,
    ]
      .filter(Boolean)
      .join(' · '),
    dataSources: ['nasa'],
    raw: row,
    links: {
      official: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng},${lat},11z`,
    },
  }
}

export function buildFirmsRequestUrl(scopeConfig) {
  const key = import.meta.env.VITE_NASA_FIRMS_MAP_KEY
  const bbox = getScopeBbox(scopeConfig)
  const area = firmsAreaForScope(scopeConfig.scope, bbox)
  return firmsApiUrl(`/api/area/csv/${key}/${FIRMS_SOURCE}/${area}/${DAY_RANGE}`)
}

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=120'

function eonetOfficialUrl(evt, lat, lng) {
  const sources = Array.isArray(evt.sources) ? evt.sources : []
  for (const source of sources) {
    const url = source?.url
    if (typeof url !== 'string' || !url.startsWith('http')) continue
    if (/eonet\.gsfc\.nasa\.gov\/api\//i.test(url)) continue
    if (/irwin\.doi\.gov/i.test(url)) continue
    return url
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng},${lat},11z`
  }
  return 'https://eonet.gsfc.nasa.gov/'
}

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
      'NASA EONET',
    ]
      .filter(Boolean)
      .join(' · '),
    dataSources: ['nasa'],
    raw: evt,
    links: { official: eonetOfficialUrl(evt, lat, lng) },
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
    .filter(e => scopeConfig.scope === 'global' || pointInBbox(e.lat, e.lng, bbox))

  return {
    events,
    requestUrl: EONET_URL,
    totalFetched: events.length,
    provider: 'eonet',
  }
}

const VIIRS_HOTSPOT_URL =
  'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/Satellite_VIIRS_Thermal_Hotspots_and_Fire_Activity/FeatureServer/0/query'

function viirsFeatureToRiskEvent(feature) {
  const props = feature?.properties ?? {}
  const coords = feature?.geometry?.coordinates
  const lng = Array.isArray(coords) ? Number(coords[0]) : Number(props.longitude)
  const lat = Array.isArray(coords) ? Number(coords[1]) : Number(props.latitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const acqDateMs = Number(props.acq_date)
  const acqDate = Number.isFinite(acqDateMs) ? new Date(acqDateMs).toISOString().slice(0, 10) : null
  const id = `firms-${lat}-${lng}-${acqDate ?? ''}-${props.OBJECTID ?? ''}`

  return {
    id,
    source: 'NASA',
    layer: 'wildfire',
    geometryType: 'point',
    lat,
    lng,
    country: lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65 ? 'US' : null,
    label: `FIRMS-${lat.toFixed(2)},${lng.toFixed(2)}`,
    title: `Fire hotspot · ${acqDate ?? 'recent'}`,
    severity: brightnessSeverity(props.bright_ti4),
    timestamp: Number.isFinite(acqDateMs) ? new Date(acqDateMs).toISOString() : null,
    confidence: props.confidence === 'high' ? 95 : props.confidence === 'nominal' ? 70 : 85,
    detail: [
      `Brightness ${props.bright_ti4 ?? 'n/a'}`,
      props.frp != null ? `FRP ${props.frp} MW` : null,
      acqDate ? `Acquired ${acqDate}` : null,
      'VIIRS thermal hotspot',
    ]
      .filter(Boolean)
      .join(' · '),
    dataSources: ['nasa'],
    raw: props,
    links: {
      official: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng},${lat},11z`,
    },
  }
}

async function fetchViirsHotspots(scopeConfig, options = {}) {
  const bbox = getScopeBbox(scopeConfig)
  const params = new URLSearchParams({
    where: 'hours_old <= 24',
    outFields: 'latitude,longitude,bright_ti4,frp,acq_date,confidence,hours_old,OBJECTID',
    outSR: '4326',
    returnGeometry: 'true',
    f: 'geojson',
    resultRecordCount: String(MAX_HOTSPOTS),
    orderByFields: 'frp DESC',
  })

  if (scopeConfig.scope !== 'global') {
    params.set('geometry', `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`)
    params.set('geometryType', 'esriGeometryEnvelope')
    params.set('inSR', '4326')
    params.set('spatialRel', 'esriSpatialRelIntersects')
  }

  const requestUrl = `${VIIRS_HOTSPOT_URL}?${params}`
  const res = await fetch(requestUrl, { signal: options.signal })
  if (!res.ok) throw new Error(`VIIRS hotspot API error (${res.status})`)

  const data = await res.json()
  if (data.error) throw new Error(data.error?.message || 'VIIRS hotspot query failed')

  const events = (data.features ?? [])
    .map(viirsFeatureToRiskEvent)
    .filter(Boolean)
    .filter(e => scopeConfig.scope === 'global' || pointInBbox(e.lat, e.lng, bbox))
    .slice(0, MAX_HOTSPOTS)

  return {
    events,
    requestUrl,
    totalFetched: events.length,
    provider: 'firms',
  }
}

async function fetchFirmsArea(scopeConfig, options = {}) {
  const url = buildFirmsRequestUrl(scopeConfig)
  const res = await fetch(url, { signal: options.signal })
  if (!res.ok) throw new Error(`NASA FIRMS API error (${res.status})`)

  const text = await res.text()
  const rows = parseFirmsCsv(text)
  const events = rows.map(rowToRiskEvent).filter(Boolean).slice(0, MAX_HOTSPOTS)

  return {
    events,
    requestUrl: url,
    totalFetched: events.length,
    provider: 'firms',
  }
}

/**
 * Active wildfire layer: named NIFC/EONET incidents plus VIIRS hotspots.
 */
export async function fetchNasaFirms(scopeConfig, options = {}) {
  const mapKey = import.meta.env.VITE_NASA_FIRMS_MAP_KEY?.trim()

  const cacheKey = riskCacheKey([
    'wildfire-v4',
    scopeConfig.scope,
    scopeConfig.countryId,
    scopeConfig.userLocation?.lat,
    scopeConfig.radiusMiles,
    DAY_RANGE,
  ])

  if (!options.skipCache) {
    const cached = getRiskCache('firms', cacheKey)
    if (cached?.events?.length) return { ...cached, fromCache: true }
  }

  const eonetPromise = fetchEonetWildfires(scopeConfig, options).catch(err => {
    if (err?.name === 'AbortError') throw err
    return null
  })

  const hotspotPromise = fetchViirsHotspots(scopeConfig, options).catch(err => {
    if (err?.name === 'AbortError') throw err
    if (!mapKey) return null
    return fetchFirmsArea(scopeConfig, options).catch(fallbackErr => {
      if (fallbackErr?.name === 'AbortError') throw fallbackErr
      return null
    })
  })

  const nifcPromise = fetchNifcWildfires(scopeConfig, options).catch(err => {
    if (err?.name === 'AbortError') throw err
    return null
  })

  const [eonet, hotspots, nifc] = await Promise.all([eonetPromise, hotspotPromise, nifcPromise])

  if (!eonet && !hotspots && !nifc) {
    const lastGood = getLastGoodRiskCache('firms', cacheKey)
    if (lastGood?.data?.events?.length) {
      return { ...lastGood.data, fromCache: true, stale: true }
    }
    throw new Error('Wildfire feeds unavailable (EONET, FIRMS, and NIFC)')
  }

  const events = mergeWildfireEvents(
    [...(nifc?.events ?? []), ...(eonet?.events ?? [])],
    hotspots?.events ?? [],
  )
  const providers = [nifc && 'nifc', eonet && 'eonet', hotspots && 'firms'].filter(Boolean)
  const payload = {
    events,
    requestUrl: nifc?.requestUrl || eonet?.requestUrl || hotspots?.requestUrl || null,
    totalFetched: events.length,
    provider: providers.join('+') || 'eonet',
    missingApiKey: false,
    usingFallback: !hotspots,
    providers,
  }

  if (events.length > 0) {
    setRiskCache('firms', cacheKey, payload)
    return payload
  }

  const lastGood = getLastGoodRiskCache('firms', cacheKey)
  if (lastGood?.data?.events?.length) {
    return { ...lastGood.data, fromCache: true, stale: true }
  }

  setRiskCache('firms', cacheKey, payload)
  return payload
}

export function firmsToSignals(markers, limit = 6) {
  return [...markers]
    .slice(0, limit)
    .map(marker => ({
      id: `firms-signal-${marker.id}`,
      severity: marker.severity,
      layer: marker.layer ?? 'wildfire',
      title: marker.title,
      headline: headlineForMarker(marker),
      locationLabel: locationLabelForMarker(marker),
      source:
        marker.source === 'NIFC'
          ? 'NIFC WFIGS'
          : marker.id?.startsWith('eonet-')
            ? 'NASA EONET'
            : 'NASA FIRMS',
      dataSources: ['nasa'],
      confidence: marker.confidence,
      action: marker.action,
      actionUrl: getMarkerReportUrl(marker),
      markerId: marker.id,
      timestamp: marker.timestamp ?? null,
      live: true,
    }))
}
