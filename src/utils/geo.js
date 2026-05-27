const EARTH_RADIUS_MILES = 3958.7613

export function distanceMiles(a, b) {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h))
}

export function destinationPoint(lat, lng, bearingDeg, distanceMiles) {
  const brng = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const d = distanceMiles / EARTH_RADIUS_MILES
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI }
}

const LOCAL_RADIUS_LINE_LAYERS = new Set(['earthquake', 'wildfire', 'flood'])

/** Line segments from user position to in-radius earthquake, wildfire, and flood events. */
export function localRadiusLinesGeoJSON(userLocation, markers, zones, radiusMiles) {
  if (!userLocation) {
    return { type: 'FeatureCollection', features: [] }
  }

  const origin = [userLocation.lng, userLocation.lat]
  const features = []

  for (const marker of markers) {
    if (!LOCAL_RADIUS_LINE_LAYERS.has(marker.layer)) continue
    if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) continue
    if (distanceMiles(userLocation, marker) > radiusMiles) continue
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [origin, [marker.lng, marker.lat]],
      },
      properties: { id: marker.id },
    })
  }

  for (const zone of zones) {
    if (!LOCAL_RADIUS_LINE_LAYERS.has(zone.layer)) continue
    const target =
      zone.lat != null && zone.lng != null
        ? { lat: zone.lat, lng: zone.lng }
        : geometryCentroid(zone.geometry)
    if (!target) continue
    if (distanceMiles(userLocation, target) > radiusMiles) continue
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [origin, [target.lng, target.lat]],
      },
      properties: { id: zone.id },
    })
  }

  return { type: 'FeatureCollection', features }
}

export function createCirclePolygon(center, radiusMiles, steps = 64) {
  const coords = []
  for (let i = 0; i <= steps; i += 1) {
    const pt = destinationPoint(center.lat, center.lng, (360 / steps) * i, radiusMiles)
    coords.push([pt.lng, pt.lat])
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}

export function zoomForRadiusMiles(radiusMiles) {
  if (radiusMiles <= 25) return 8.2
  if (radiusMiles <= 50) return 7.4
  if (radiusMiles <= 75) return 6.9
  if (radiusMiles <= 100) return 6.5
  return 5.8
}

function ringCentroid(ring) {
  let sumLat = 0
  let sumLng = 0
  let n = 0
  for (const [lng, lat] of ring) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      sumLat += lat
      sumLng += lng
      n += 1
    }
  }
  return n ? { lat: sumLat / n, lng: sumLng / n } : null
}

export function geometryCentroid(geometry) {
  if (!geometry) return null
  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates
    return { lat, lng }
  }
  if (geometry.type === 'Polygon') {
    return ringCentroid(geometry.coordinates[0])
  }
  if (geometry.type === 'MultiPolygon') {
    const first = geometry.coordinates[0]?.[0]
    return first ? ringCentroid(first) : null
  }
  return null
}

function pointInRing(point, ring) {
  const { lng, lat } = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInPolygon(point, geometry) {
  if (!geometry || !point) return false
  if (geometry.type === 'Polygon') {
    const [outer, ...holes] = geometry.coordinates
    if (!outer || !pointInRing(point, outer)) return false
    return !holes.some(hole => pointInRing(point, hole))
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(poly => pointInPolygon(point, { type: 'Polygon', coordinates: poly }))
  }
  return false
}
