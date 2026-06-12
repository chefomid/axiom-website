import { fetchAllUsgsFeatures } from '../utils/fetchPaginated'
import { COUNTRIES } from '../data/commandMapData'
import { USGS_CATALOG_MIN_MAGNITUDE } from '../utils/earthquakeMagnitude'
import { distanceMiles } from '../utils/geo'
import { getMarkerReportUrl } from '../utils/markerReportUrl'
import { headlineForMarker, locationLabelForMarker } from '../utils/signalLocation'
import { COUNTRY_BBOX, pointInBbox } from '../utils/scopeBbox'

const USGS_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
const LOOKBACK_DAYS = 30
/** USGS FDSNWS cap for maxradiuskm (≈1,243 mi). */
const USGS_MAX_RADIUS_KM = 2000

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

  params.minmagnitude = USGS_CATALOG_MIN_MAGNITUDE

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
    title: mag != null ? `M${mag.toFixed(1)} · ${props.place}` : props.place,
    place: props.place ?? null,
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
    timestamp: props.time,
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

const USGS_MAX_EVENTS = 20000
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

/** Worldwide regions, each gets a share of the catalog budget so all continents appear on Global. */
const GLOBAL_WORLD_REGIONS = [
  { id: 'americas-west', minlongitude: -180, maxlongitude: -90, minlatitude: -60, maxlatitude: 72 },
  { id: 'americas-east', minlongitude: -90, maxlongitude: -30, minlatitude: -60, maxlatitude: 72 },
  { id: 'atlantic', minlongitude: -30, maxlongitude: 20, minlatitude: -35, maxlatitude: 72 },
  { id: 'europe-africa', minlongitude: 20, maxlongitude: 55, minlatitude: -35, maxlatitude: 72 },
  { id: 'middle-east', minlongitude: 55, maxlongitude: 90, minlatitude: -10, maxlatitude: 50 },
  { id: 'central-asia', minlongitude: 90, maxlongitude: 120, minlatitude: -10, maxlatitude: 55 },
  { id: 'east-asia', minlongitude: 120, maxlongitude: 150, minlatitude: -10, maxlatitude: 55 },
  { id: 'pacific', minlongitude: 150, maxlongitude: 180, minlatitude: -50, maxlatitude: 20 },
]

function splitDateRangeIntoBuckets(startDate, endDate, maxBuckets = 30) {
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()
  const spanMs = endMs - startMs
  if (spanMs <= 0) return [{ startDate, endDate }]

  const years = spanMs / MS_PER_YEAR
  const numBuckets = Math.max(1, Math.min(maxBuckets, Math.ceil(years)))
  const buckets = []

  for (let i = 0; i < numBuckets; i++) {
    buckets.push({
      startDate: new Date(startMs + (spanMs * i) / numBuckets),
      endDate: new Date(startMs + (spanMs * (i + 1)) / numBuckets),
    })
  }

  return buckets
}

function distributeEventBudget(total, numBuckets) {
  const base = Math.floor(total / numBuckets)
  const extra = total % numBuckets
  return Array.from({ length: numBuckets }, (_, i) => base + (i < extra ? 1 : 0))
}

function featureDedupeKey(feature) {
  const props = feature.properties ?? {}
  const code = props.code ?? props.ids?.split(',')[0]
  if (code) return String(code)
  const [lng, lat] = feature.geometry?.coordinates ?? []
  return `${lng}|${lat}|${props.time ?? ''}|${props.mag ?? ''}`
}

async function fetchHistoryBucket(config, bucket, maxEvents, options = {}) {
  const bucketConfig = {
    ...config,
    startDate: bucket.startDate,
    endDate: bucket.endDate,
  }

  const buildUrl = pagination => {
    const params = buildHistoryQueryParams(bucketConfig, pagination)
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    )
    return `${USGS_ENDPOINT}?${query}`
  }

  return fetchAllUsgsFeatures(buildUrl, {
    signal: options.signal,
    maxEvents,
    pageSize: Math.min(2000, maxEvents),
  })
}

/** Cap global time buckets so long windows stay fast (USGS catalog max 20k events total). */
const GLOBAL_MAX_TIME_BUCKETS = 10

function mergeHistoryFeatures(features, seen, mergedFeatures, maxEvents = USGS_MAX_EVENTS) {
  for (const feature of features) {
    if (mergedFeatures.length >= maxEvents) break
    const key = featureDedupeKey(feature)
    if (seen.has(key)) continue
    seen.add(key)
    mergedFeatures.push(feature)
  }
}

/**
 * Worldwide USGS catalog, time-stratified unbounded queries so every region with
 * catalog coverage (US, Mexico, Japan, etc.) can appear in the Global view.
 */
async function fetchGlobalRegionalHistory(config, options = {}) {
  const { startDate, endDate } = config
  const worldwideConfig = { ...config, global: true, regionBbox: undefined }
  const timeBuckets = splitDateRangeIntoBuckets(startDate, endDate, GLOBAL_MAX_TIME_BUCKETS)
  const budgets = distributeEventBudget(USGS_MAX_EVENTS, timeBuckets.length)
  const requestUrl = buildUsgsHistoryRequestUrl(worldwideConfig, { limit: 2000 })

  const seen = new Set()
  const mergedFeatures = []
  let bucketTruncated = false

  for (let i = 0; i < timeBuckets.length; i++) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const budget = budgets[i]
    if (budget <= 0) continue

    try {
      const page = await fetchHistoryBucket(worldwideConfig, timeBuckets[i], budget, options)
      if (page.length >= budget) bucketTruncated = true
      mergeHistoryFeatures(page, seen, mergedFeatures)
    } catch (err) {
      if (err.name === 'AbortError') throw err
      console.warn('USGS global catalog bucket failed:', err)
    }

    if (mergedFeatures.length >= USGS_MAX_EVENTS) break
  }

  if (mergedFeatures.length === 0) {
    try {
      const page = await fetchHistoryBucket(
        worldwideConfig,
        { startDate, endDate },
        USGS_MAX_EVENTS,
        options,
      )
      if (page.length >= USGS_MAX_EVENTS) bucketTruncated = true
      mergeHistoryFeatures(page, seen, mergedFeatures)
    } catch (err) {
      if (err.name === 'AbortError') throw err
      console.warn('USGS global catalog fallback failed:', err)
    }
  }

  const remaining = USGS_MAX_EVENTS - mergedFeatures.length
  if (remaining > 0) {
    const regionBudgets = distributeEventBudget(remaining, GLOBAL_WORLD_REGIONS.length)
    const regionTimeBuckets = splitDateRangeIntoBuckets(startDate, endDate, GLOBAL_MAX_TIME_BUCKETS)

    for (let t = 0; t < regionTimeBuckets.length; t++) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      if (mergedFeatures.length >= USGS_MAX_EVENTS) break

      const bucket = regionTimeBuckets[t]
      const regionPages = await Promise.all(
        GLOBAL_WORLD_REGIONS.map(async (region, r) => {
          if (options.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }

          const regionBudget = regionBudgets[r]
          if (regionBudget <= 0) return { page: [], budget: 0 }

          const timeBudgets = distributeEventBudget(regionBudget, regionTimeBuckets.length)
          const budget = timeBudgets[t]
          if (budget <= 0) return { page: [], budget: 0 }

          try {
            const page = await fetchHistoryBucket(
              { ...config, global: false, regionBbox: region },
              bucket,
              budget,
              options,
            )
            return { page, budget }
          } catch (err) {
            if (err.name === 'AbortError') throw err
            console.warn(`USGS global region ${region.id} failed:`, err)
            return { page: [], budget: 0 }
          }
        }),
      )

      for (const { page, budget } of regionPages) {
        if (budget > 0 && page.length >= budget) bucketTruncated = true
        mergeHistoryFeatures(page, seen, mergedFeatures)
        if (mergedFeatures.length >= USGS_MAX_EVENTS) break
      }
    }
  }

  let events = mergedFeatures.map(featureToAnalyticsEvent)
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()
  events = events.filter(e => Number.isFinite(e.time) && e.time >= startMs && e.time <= endMs)

  return {
    events,
    requestUrl,
    totalFetched: mergedFeatures.length,
    truncated: bucketTruncated || mergedFeatures.length >= USGS_MAX_EVENTS,
  }
}

function featureToAnalyticsEvent(feature) {
  const [lng, lat, depth] = feature.geometry.coordinates
  const props = feature.properties
  return {
    lat,
    lng,
    mag: props.mag,
    time: props.time,
    place: props.place,
    depth: Number.isFinite(depth) ? depth : null,
  }
}

function buildHistoryQueryParams(
  { center, maxRadiusMiles = 250, minMagnitude = 2.5, startDate, endDate, national, global, countryId, regionBbox },
  pagination = {},
) {
  const params = {
    format: 'geojson',
    starttime: formatDate(startDate),
    endtime: formatDate(endDate),
    orderby: 'time',
    minmagnitude: USGS_CATALOG_MIN_MAGNITUDE,
  }

  if (regionBbox) {
    Object.assign(params, regionBbox)
  } else if (global) {
    // Worldwide catalog, no lat/lng or bbox filter (all USGS-covered regions).
  } else {
    const bbox = national && countryId ? USGS_COUNTRY_BBOX[countryId] : null
    if (bbox) {
      Object.assign(params, bbox)
    } else if (center) {
      params.latitude = center.lat
      params.longitude = center.lng
      params.maxradiuskm = Math.min(
        USGS_MAX_RADIUS_KM,
        Math.round(maxRadiusMiles * 1.60934),
      )
    }
  }

  if (pagination.limit != null) params.limit = pagination.limit
  if (pagination.offset != null && pagination.offset >= 1) params.offset = pagination.offset

  return params
}

export function buildUsgsHistoryRequestUrl(config, pagination = { limit: 2000 }) {
  const params = buildHistoryQueryParams(config, pagination)
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  )
  return `${USGS_ENDPOINT}?${query}`
}

/**
 * Historical earthquake catalog for analytics.
 * Uses time-stratified bucket fetches when the catalog exceeds the global cap.
 * For smaller catalogs, a single-window fetch preserves true period-to-period counts.
 */
export async function fetchUsgsEarthquakeHistory(config, options = {}) {
  const { center, maxRadiusMiles, global, national, startDate, endDate } = config
  if (!startDate || !endDate) {
    return { events: [], requestUrl: null, totalFetched: 0, truncated: false }
  }

  if (global) {
    return fetchGlobalRegionalHistory(config, options)
  }

  const requestUrl = buildUsgsHistoryRequestUrl(config, { limit: 2000 })

  // Single-window fetch first, when under the cap, period counts stay accurate.
  const singlePage = await fetchHistoryBucket(config, { startDate, endDate }, USGS_MAX_EVENTS, options)
  if (singlePage.length < USGS_MAX_EVENTS) {
    let events = singlePage.map(featureToAnalyticsEvent)
    const startMs = startDate.getTime()
    const endMs = endDate.getTime()
    events = events.filter(e => Number.isFinite(e.time) && e.time >= startMs && e.time <= endMs)

    if (!national && center && Number.isFinite(maxRadiusMiles)) {
      events = events.filter(e => distanceMiles(center, e) <= maxRadiusMiles)
    }

    return {
      events,
      requestUrl,
      totalFetched: singlePage.length,
      truncated: false,
    }
  }

  // Country/national bbox queries routinely hit the 20k cap, return the first page
  // instead of 30+ sequential USGS round-trips (sidebar already warns when truncated).
  if (national) {
    let events = singlePage.map(featureToAnalyticsEvent)
    const startMs = startDate.getTime()
    const endMs = endDate.getTime()
    events = events.filter(e => Number.isFinite(e.time) && e.time >= startMs && e.time <= endMs)

    return {
      events,
      requestUrl,
      totalFetched: singlePage.length,
      truncated: true,
    }
  }

  const buckets = splitDateRangeIntoBuckets(startDate, endDate, 12)
  const budgets = distributeEventBudget(USGS_MAX_EVENTS, buckets.length)

  const seen = new Set()
  const mergedFeatures = []
  let bucketTruncated = false

  for (let i = 0; i < buckets.length; i++) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const budget = budgets[i]
    if (budget <= 0) continue

    const page = await fetchHistoryBucket(config, buckets[i], budget, options)
    if (page.length >= budget) bucketTruncated = true

    for (const feature of page) {
      const key = featureDedupeKey(feature)
      if (seen.has(key)) continue
      seen.add(key)
      mergedFeatures.push(feature)
    }
  }

  let events = mergedFeatures.map(featureToAnalyticsEvent)

  const startMs = startDate.getTime()
  const endMs = endDate.getTime()
  events = events.filter(e => Number.isFinite(e.time) && e.time >= startMs && e.time <= endMs)

  if (!global && !national && center && Number.isFinite(maxRadiusMiles)) {
    events = events.filter(e => distanceMiles(center, e) <= maxRadiusMiles)
  }

  return {
    events,
    requestUrl,
    totalFetched: mergedFeatures.length,
    truncated: bucketTruncated || mergedFeatures.length >= USGS_MAX_EVENTS,
  }
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
      headline: headlineForMarker(marker),
      locationLabel: locationLabelForMarker(marker),
      source: 'USGS FDSNWS',
      dataSources: ['usgs'],
      confidence: 100,
      action: marker.action,
      actionUrl: getMarkerReportUrl(marker),
      markerId: marker.id,
      timestamp: marker.timestamp ?? marker.time ?? null,
      live: true,
    }))
}
