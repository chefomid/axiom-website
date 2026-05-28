import { distanceMiles } from './geo'

export const MAX_USER_PINS = 10

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function formatDistance(miles) {
  if (!Number.isFinite(miles)) return '—'
  if (miles < 0.1) return `${(miles * 5280).toFixed(0)} ft`
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

export function bearingDegrees(from, to) {
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return (deg + 360) % 360
}

export function formatBearing(degrees) {
  const idx = Math.round(degrees / 45) % 8
  return `${CARDINALS[idx]} ${Math.round(degrees)}°`
}

export function segmentMidpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
}

export function segmentKey(fromId, toId) {
  return [fromId, toId].sort().join('--')
}

export function createSegment(fromPin, toPin) {
  const distance = distanceMiles(fromPin, toPin)
  return {
    id: `seg-${segmentKey(fromPin.id, toPin.id)}`,
    fromId: fromPin.id,
    toId: toPin.id,
    distanceMiles: distance,
    midpoint: segmentMidpoint(fromPin, toPin),
    bearing: bearingDegrees(fromPin, toPin),
  }
}

export function pinsToGeoJSON(pins, selectedPinId) {
  return {
    type: 'FeatureCollection',
    features: pins.map(pin => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
      properties: {
        id: pin.id,
        label: pin.label,
        selected: pin.id === selectedPinId,
      },
    })),
  }
}

/** Closed triangles formed by three mutually connected measure pins. */
export function findPinTriangles(pins, segments) {
  const adj = new Map()
  for (const seg of segments) {
    if (!adj.has(seg.fromId)) adj.set(seg.fromId, new Set())
    if (!adj.has(seg.toId)) adj.set(seg.toId, new Set())
    adj.get(seg.fromId).add(seg.toId)
    adj.get(seg.toId).add(seg.fromId)
  }

  const pinById = new Map(pins.map(p => [p.id, p]))
  const seen = new Set()
  const triangles = []

  for (const seg of segments) {
    const a = seg.fromId
    const b = seg.toId
    const neighborsA = adj.get(a)
    const neighborsB = adj.get(b)
    if (!neighborsA || !neighborsB) continue

    for (const c of neighborsA) {
      if (c === b || !neighborsB.has(c)) continue
      const key = [a, b, c].sort().join('--')
      if (seen.has(key)) continue
      seen.add(key)

      const pa = pinById.get(a)
      const pb = pinById.get(b)
      const pc = pinById.get(c)
      if (!pa || !pb || !pc) continue

      const areaSqMiles = sphericalTriangleAreaSqMiles(pa, pb, pc)
      const centroid = {
        lat: (pa.lat + pb.lat + pc.lat) / 3,
        lng: (pa.lng + pb.lng + pc.lng) / 3,
      }
      triangles.push({ id: key, pins: [pa, pb, pc], areaSqMiles, centroid })
    }
  }

  return triangles
}

function sphericalTriangleAreaSqMiles(a, b, c) {
  const R = 3958.7613
  const toRad = miles => miles / R
  const sideA = toRad(distanceMiles(b, c))
  const sideB = toRad(distanceMiles(a, c))
  const sideC = toRad(distanceMiles(a, b))
  const s = (sideA + sideB + sideC) / 2
  const tanE4 = Math.sqrt(
    Math.max(0, Math.tan(s / 2) * Math.tan((s - sideA) / 2) * Math.tan((s - sideB) / 2) * Math.tan((s - sideC) / 2)),
  )
  const excess = 4 * Math.atan(tanE4)
  return excess * R * R
}

export function formatArea(sqMiles) {
  if (!Number.isFinite(sqMiles) || sqMiles <= 0) return '—'
  if (sqMiles < 1) return `${Math.round(sqMiles * 640)} acres`
  if (sqMiles < 10_000) return `${sqMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })} sq mi`
  return `${Math.round(sqMiles).toLocaleString()} sq mi`
}

export function pinTrianglesToGeoJSON(triangles) {
  return {
    type: 'FeatureCollection',
    features: triangles.map(triangle => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [triangle.pins[0].lng, triangle.pins[0].lat],
            [triangle.pins[1].lng, triangle.pins[1].lat],
            [triangle.pins[2].lng, triangle.pins[2].lat],
            [triangle.pins[0].lng, triangle.pins[0].lat],
          ],
        ],
      },
      properties: {
        id: triangle.id,
        areaSqMiles: triangle.areaSqMiles,
      },
    })),
  }
}

export function segmentsToGeoJSON(segments, pins) {
  const pinById = new Map(pins.map(p => [p.id, p]))
  return {
    type: 'FeatureCollection',
    features: segments
      .map(seg => {
        const from = pinById.get(seg.fromId)
        const to = pinById.get(seg.toId)
        if (!from || !to) return null
        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [from.lng, from.lat],
              [to.lng, to.lat],
            ],
          },
          properties: {
            id: seg.id,
            distanceMiles: seg.distanceMiles,
          },
        }
      })
      .filter(Boolean),
  }
}
