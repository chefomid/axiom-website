import { defaultFetchHeaders } from '../utils/apiBase'
import { USGS_INTERACTIVE_FAULT_MAP_URL, US_NAMED_FAULTS, isInConus } from '../data/usNamedFaults'
import { formatPlateBoundaryLabel } from '../utils/earthquakeModeling'
import { distanceMiles } from '../utils/geo'
import { densifyLineString, filterPointsByBbox } from '../utils/faultZoneDots'

const ZONE_DOTS_URL = '/data/earthquake-zones.geojson'

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] }

const PLATE_BOUNDARY_REFERENCE = {
  referenceUrl: USGS_INTERACTIVE_FAULT_MAP_URL,
  referenceSource: 'USGS Interactive Fault Map',
}

let zoneDotsCache = null
let zoneDotsPromise = null

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

/** Synchronous bbox filter — instant once {@link preloadFaultLineDots} has resolved. */
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
