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

/** Axis-aligned square centered on a point; halfSideMiles = center to each edge. */
export function createSquarePolygon(center, halfSideMiles) {
  const cornerDist = halfSideMiles * Math.SQRT2
  const coords = [45, 135, 225, 315].map(bearing => {
    const pt = destinationPoint(center.lat, center.lng, bearing, cornerDist)
    return [pt.lng, pt.lat]
  })
  coords.push(coords[0])
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}

export function createSquareRingPolygon(center, innerHalfSide, outerHalfSide) {
  const outer = createSquarePolygon(center, outerHalfSide).geometry.coordinates[0]
  const inner = createSquarePolygon(center, innerHalfSide).geometry.coordinates[0].slice().reverse()
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [outer, inner] },
  }
}

export function squareBoundsForHalfSide(center, halfSideMiles) {
  const cornerDist = halfSideMiles * Math.SQRT2
  const corners = [45, 135, 225, 315].map(bearing =>
    destinationPoint(center.lat, center.lng, bearing, cornerDist),
  )
  const lats = corners.map(c => c.lat)
  const lngs = corners.map(c => c.lng)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

/** World polygon with a circular hole, dims everything outside the analysis radius. */
export function createCircleOutsideMask(center, radiusMiles, steps = 64) {
  const inner = createCirclePolygon(center, radiusMiles, steps).geometry.coordinates[0].slice().reverse()
  const outer = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ]
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [outer, inner] },
  }
}

export function circleBounds(center, radiusMiles, steps = 64) {
  const ring = createCirclePolygon(center, radiusMiles, steps).geometry.coordinates[0]
  const lngs = ring.map(c => c[0])
  const lats = ring.map(c => c[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

/** [[swLng, swLat], [neLng, neLat]] for map.fitBounds from [minLon, minLat, maxLon, maxLat]. */
export function bboxToBounds(bbox) {
  if (!bbox || bbox.length !== 4) return null
  const [minLon, minLat, maxLon, maxLat] = bbox
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ]
}

/** [[swLng, swLat], [neLng, neLat]] for map.fitBounds from event points. */
export function eventsBounds(events, paddingDeg = 0.75) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const event of events) {
    if (!Number.isFinite(event.lat) || !Number.isFinite(event.lng)) continue
    minLng = Math.min(minLng, event.lng)
    minLat = Math.min(minLat, event.lat)
    maxLng = Math.max(maxLng, event.lng)
    maxLat = Math.max(maxLat, event.lat)
  }

  if (!Number.isFinite(minLng)) return null

  return [
    [minLng - paddingDeg, minLat - paddingDeg],
    [maxLng + paddingDeg, maxLat + paddingDeg],
  ]
}

export function createRingPolygon(center, innerMiles, outerMiles, steps = 64) {
  const outer = createCirclePolygon(center, outerMiles, steps).geometry.coordinates[0]
  const inner = createCirclePolygon(center, innerMiles, steps).geometry.coordinates[0].slice().reverse()
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [outer, inner] },
  }
}

export function zoomForRadiusMiles(radiusMiles) {
  if (radiusMiles <= 25) return 8.2
  if (radiusMiles <= 50) return 7.4
  if (radiusMiles <= 75) return 6.9
  if (radiusMiles <= 100) return 6.5
  if (radiusMiles <= 150) return 6.0
  if (radiusMiles <= 200) return 5.5
  return 5.2
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
