import { COUNTRIES } from '../data/commandMapData'
import { destinationPoint } from './geo'

export const COUNTRY_BBOX = {
  US: { west: -180, south: 18, east: -65, north: 72 },
  CA: { west: -141, south: 41, east: -52, north: 84 },
  MX: { west: -118, south: 14, east: -86, north: 33 },
  GB: { west: -11, south: 49, east: 2, north: 61 },
  DE: { west: 5, south: 47, east: 16, north: 55 },
  AU: { west: 112, south: -44, east: 154, north: -10 },
  JP: { west: 122, south: 24, east: 146, north: 46 },
}

/** Continental US — default for global NWS/FIRMS cap */
export const CONUS_BBOX = { west: -125, south: 24, east: -66, north: 50 }

/**
 * @param {{ scope: string, userLocation?: { lat: number, lng: number }, radiusMiles?: number, countryId?: string }} config
 */
export function getScopeBbox(config) {
  const { scope, userLocation, radiusMiles = 50, countryId = 'US' } = config

  if (scope === 'local' && userLocation) {
    const corners = [
      destinationPoint(userLocation.lat, userLocation.lng, 0, radiusMiles),
      destinationPoint(userLocation.lat, userLocation.lng, 90, radiusMiles),
      destinationPoint(userLocation.lat, userLocation.lng, 180, radiusMiles),
      destinationPoint(userLocation.lat, userLocation.lng, 270, radiusMiles),
    ]
    const lats = corners.map(c => c.lat)
    const lngs = corners.map(c => c.lng)
    return {
      west: Math.min(...lngs),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      north: Math.max(...lats),
    }
  }

  if (scope === 'national') {
    return COUNTRY_BBOX[countryId] ?? CONUS_BBOX
  }

  return CONUS_BBOX
}

export function bboxToEsriEnvelope(bbox) {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
}

export function bboxToFirmsArea(bbox) {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
}

export function bboxIntersects(a, b) {
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north)
}

export function pointInBbox(lat, lng, bbox) {
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north
}

/**
 * @param {{ scope: string, countryId?: string }} config
 */
export function getScopeCenter(config) {
  const { scope, countryId = 'US', userLocation } = config
  if (scope === 'local' && userLocation) return userLocation
  const country = COUNTRIES.find(c => c.id === countryId)
  if (country) return { lat: country.center[1], lng: country.center[0] }
  return { lat: 39.8, lng: -98.5 }
}
