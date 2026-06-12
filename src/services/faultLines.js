import { defaultFetchHeaders } from '../utils/apiBase'
import { USGS_INTERACTIVE_FAULT_MAP_URL, US_NAMED_FAULTS, isInConus } from '../data/usNamedFaults'
import { formatPlateBoundaryLabel } from '../utils/earthquakeModeling'
import { distanceMiles } from '../utils/geo'
import { densifyLineString, filterPointsByBbox } from '../utils/faultZoneDots'

/** Within this distance, CONUS map hover prefers a named major fault over the plate-boundary dot. */
const NAMED_FAULT_HOVER_MILES = 25

const ZONE_DOTS_URL = '/data/earthquake-zones.geojson'
const ZONE_LINES_URL = '/data/pb2002-boundaries.json'

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] }

const PLATE_BOUNDARY_REFERENCE = {
  referenceUrl: USGS_INTERACTIVE_FAULT_MAP_URL,
  referenceSource: 'USGS Interactive Fault Map',
}

let zoneDotsCache = null
let zoneDotsPromise = null
let zoneLinesCache = null
let zoneLinesPromise = null

/** Start loading solid fault-line geometry for map display. */
export function preloadFaultLines() {
  if (zoneLinesCache) return Promise.resolve(zoneLinesCache)
  if (zoneLinesPromise) return zoneLinesPromise

  zoneLinesPromise = fetch(ZONE_LINES_URL, { headers: defaultFetchHeaders() })
    .then(res => {
      if (!res.ok) throw new Error('Fault line data unavailable')
      return res.json()
    })
    .then(data => {
      zoneLinesCache = data
      return data
    })
    .finally(() => {
      zoneLinesPromise = null
    })

  return zoneLinesPromise
}

/** Full PB2002 line dataset for map rendering. */
export function getAllFaultLines() {
  return zoneLinesCache ?? EMPTY_COLLECTION
}

/** Start loading fault-line dots as early as possible (e.g. when analysis opens). */
export function preloadFaultLineDots() {
  if (zoneDotsCache) return Promise.resolve(zoneDotsCache)
  if (zoneDotsPromise) return zoneDotsPromise

  zoneDotsPromise = fetch(ZONE_DOTS_URL, { headers: defaultFetchHeaders() })
    .then(res => {
      if (!res.ok) throw new Error('Fault line data unavailable')
      return res.json()
    })
    .then(data => {
      zoneDotsCache = data
      return data
    })
    .finally(() => {
      zoneDotsPromise = null
    })

  return zoneDotsPromise
}

export function getCachedFaultLineDots() {
  return zoneDotsCache
}

/** Synchronous bbox filter, instant once {@link preloadFaultLineDots} has resolved. */
export function getFaultLinesForBbox(bbox) {
  if (!zoneDotsCache) return EMPTY_COLLECTION
  return filterPointsByBbox(zoneDotsCache, bbox)
}

/** Full global dataset for instant toggle without per-viewport fetches. */
export function getAllFaultLineDots() {
  return zoneDotsCache ?? EMPTY_COLLECTION
}

/** Expand map bounds slightly so zone dots near the edge still render. */
export function paddedMapBbox(map, paddingRatio = 0.08) {
  const bounds = map.getBounds()
  const west = bounds.getWest()
  const east = bounds.getEast()
  const south = bounds.getSouth()
  const north = bounds.getNorth()
  const lonPad = (east - west) * paddingRatio
  const latPad = (north - south) * paddingRatio
  return [west - lonPad, south - latPad, east + lonPad, north + latPad]
}

function nearestNamedUsFault(center) {
  if (!center || !isInConus(center.lat, center.lng)) return null

  let best = null

  for (const fault of US_NAMED_FAULTS) {
    const dots = densifyLineString(fault.coordinates, 0.15)
    for (const [lng, lat] of dots) {
      const dist = distanceMiles(center, { lat, lng })
      if (!best || dist < best.distanceMiles) {
        best = {
          distanceMiles: dist,
          displayName: fault.name,
          region: fault.region,
          source: 'named-fault',
          faultId: fault.id,
          referenceUrl: fault.referenceUrl,
          referenceSource: fault.referenceSource ?? 'USGS',
        }
      }
    }
  }

  return best
}

function nearestPlateBoundaryDot(center) {
  const collection = getAllFaultLineDots()
  const features = collection.features ?? []
  if (!features.length) return null

  let best = null

  for (const feature of features) {
    const [lng, lat] = feature.geometry?.coordinates ?? []
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    const dist = distanceMiles(center, { lat, lng })
    if (!best || dist < best.distanceMiles) {
      const rawCode = feature.properties?.name ?? ''
      best = {
        distanceMiles: dist,
        displayName: formatPlateBoundaryLabel(rawCode),
        source: 'plate-boundary',
        rawCode,
        ...PLATE_BOUNDARY_REFERENCE,
      }
    }
  }

  return best
}

/**
 * Find the nearest mapped fault to a location.
 * US CONUS locations prefer named major faults; all others use PB2002 plate boundaries.
 */
export function findNearestFault(center) {
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
    return null
  }

  const named = nearestNamedUsFault(center)
  const plate = nearestPlateBoundaryDot(center)

  if (named && plate) {
    return named.distanceMiles <= plate.distanceMiles ? named : plate
  }

  return named ?? plate
}

/**
 * Display label and official reference for a hovered/clicked fault line feature.
 * @param {import('geojson').Feature} feature, PB2002 line or compatible GeoJSON feature
 * @param {{ lat: number, lng: number }} lngLat, map event lngLat
 */
export function getFaultInfoFromFeature(feature, lngLat) {
  if (!lngLat || !Number.isFinite(lngLat.lat) || !Number.isFinite(lngLat.lng)) {
    return null
  }
  const plateCode = feature?.properties?.Name ?? feature?.properties?.name ?? ''
  return getFaultInfoAtLocation({ lat: lngLat.lat, lng: lngLat.lng }, plateCode)
}

/**
 * Display label and official reference for a map hover/click at a fault-line dot.
 * @param {{ lat: number, lng: number }} location
 * @param {string} [hoveredPlateCode], `name` from the hovered PB2002 zone dot
 */
export function getFaultInfoAtLocation(location, hoveredPlateCode) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return null
  }

  const named = nearestNamedUsFault(location)
  if (named && named.distanceMiles <= NAMED_FAULT_HOVER_MILES) {
    return {
      displayName: named.displayName,
      referenceUrl: named.referenceUrl,
      referenceSource: named.referenceSource ?? 'USGS',
    }
  }

  const code = hoveredPlateCode ?? ''
  return {
    displayName: formatPlateBoundaryLabel(code),
    referenceUrl: PLATE_BOUNDARY_REFERENCE.referenceUrl,
    referenceSource: PLATE_BOUNDARY_REFERENCE.referenceSource,
  }
}
