import { destinationPoint, distanceMiles } from './geo'

export const MAX_USER_PINS = 10

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function formatDistance(miles) {
  if (!Number.isFinite(miles)) return '-'
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

export function hasSegment(segments, fromId, toId) {
  const key = segmentKey(fromId, toId)
  return segments.some(s => segmentKey(s.fromId, s.toId) === key)
}

export function removeSegment(segs, fromId, toId) {
  const key = segmentKey(fromId, toId)
  return segs.filter(s => segmentKey(s.fromId, s.toId) !== key)
}

export function pinsInChain(pins, chainId) {
  return pins.filter(p => (p.chainId ?? 0) === chainId)
}

/** Nearest distance from a point to a great-circle segment, in miles. */
export function pointToSegmentDistanceMiles(point, from, to) {
  const segDist = distanceMiles(from, to)
  if (segDist < 1e-6) return distanceMiles(point, from)

  const steps = Math.max(6, Math.ceil(segDist / Math.max(25, segDist * 0.05)))
  const bearing = bearingDegrees(from, to)
  let minDist = Infinity

  for (let i = 0; i <= steps; i += 1) {
    const sample = destinationPoint(from.lat, from.lng, bearing, (segDist * i) / steps)
    minDist = Math.min(minDist, distanceMiles(point, sample))
  }

  return minDist
}

/** First pin blocking a segment (within threshold), excluding endpoint ids. */
export function segmentInterferingPin(from, to, pins, excludeIds = new Set(), thresholdMiles) {
  const segDist = distanceMiles(from, to)
  const threshold =
    thresholdMiles ?? Math.max(0.05, Math.min(50, segDist * 0.03))

  for (const pin of pins) {
    if (excludeIds.has(pin.id) || pin.id === from.id || pin.id === to.id) continue
    if (pointToSegmentDistanceMiles(pin, from, to) <= threshold) return pin
  }

  return null
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

export function findShapeById(shapeId, pins, segments) {
  if (!shapeId) return null

  const triangle = findPinTriangles(pins, segments).find(item => item.id === shapeId)
  if (triangle) return { ...triangle, shape: 'triangle' }

  const quad = findPinQuads(pins, segments).find(item => item.id === shapeId)
  if (quad) return { ...quad, shape: 'quad' }

  return null
}

function pinsByChain(pins) {
  if (pins.length === 0) return []

  const chains = []
  let current = []
  let lastChainId = pins[0].chainId ?? 0

  for (const pin of pins) {
    const chainId = pin.chainId ?? 0
    if (current.length > 0 && chainId !== lastChainId) {
      chains.push(current)
      current = []
    }
    current.push(pin)
    lastChainId = chainId
  }

  if (current.length > 0) chains.push(current)
  return chains
}

function tryAddQuad(group, segments, quads) {
  if (group.length < 4) return
  const [a, b, c, d] = group
  if (
    !hasSegment(segments, a.id, b.id) ||
    !hasSegment(segments, b.id, c.id) ||
    !hasSegment(segments, c.id, d.id) ||
    !hasSegment(segments, d.id, a.id)
  ) {
    return
  }

  const areaSqMiles = quadAreaSqMiles(a, b, c, d)
  const centroid = {
    lat: (a.lat + b.lat + c.lat + d.lat) / 4,
    lng: (a.lng + b.lng + c.lng + d.lng) / 4,
  }
  quads.push({
    id: [a.id, b.id, c.id, d.id].sort().join('--'),
    pins: group,
    areaSqMiles,
    centroid,
  })
}

/** Groups of four sequential pins with a closed perimeter (no diagonal). */
export function findPinQuads(pins, segments) {
  const quads = []

  for (const chainPins of pinsByChain(pins)) {
    for (let i = 0; i + 3 < chainPins.length; i += 4) {
      tryAddQuad(chainPins.slice(i, i + 4), segments, quads)
    }
  }

  return quads
}

function quadAreaSqMiles(a, b, c, d) {
  return (
    sphericalTriangleAreaSqMiles(a, b, c) + sphericalTriangleAreaSqMiles(a, c, d)
  )
}

/** Reposition four pins into a square with the same center and average side length. */
export function computeSquarePinPositions(quadPins) {
  if (!quadPins || quadPins.length < 4) return null

  const quad = quadPins.slice(0, 4)
  const center = {
    lat: quad.reduce((sum, pin) => sum + pin.lat, 0) / 4,
    lng: quad.reduce((sum, pin) => sum + pin.lng, 0) / 4,
  }

  const edgeLengths = [
    distanceMiles(quad[0], quad[1]),
    distanceMiles(quad[1], quad[2]),
    distanceMiles(quad[2], quad[3]),
    distanceMiles(quad[3], quad[0]),
  ]
  const sideMiles = edgeLengths.reduce((sum, len) => sum + len, 0) / edgeLengths.length
  const halfDiagonal = (sideMiles / 2) * Math.SQRT2
  const baseBearing = bearingDegrees(quad[0], quad[1])

  return [45, 135, 225, 315].map(offset =>
    destinationPoint(center.lat, center.lng, (baseBearing + offset) % 360, halfDiagonal),
  )
}

export function perimeterSegmentsForPins(groupPins) {
  const segments = []
  for (let i = 0; i < groupPins.length; i += 1) {
    const from = groupPins[i]
    const to = groupPins[(i + 1) % groupPins.length]
    segments.push(createSegment(from, to))
  }
  return segments
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
  if (!Number.isFinite(sqMiles) || sqMiles <= 0) return '-'
  if (sqMiles < 1) return `${Math.round(sqMiles * 640)} acres`
  if (sqMiles < 10_000) return `${sqMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })} sq mi`
  return `${Math.round(sqMiles).toLocaleString()} sq mi`
}

export function pinShapesToGeoJSON(triangles, quads = []) {
  const triangleFeatures = triangles.map(triangle => ({
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
      shape: 'triangle',
    },
  }))

  const quadFeatures = quads.map(quad => ({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [quad.pins[0].lng, quad.pins[0].lat],
          [quad.pins[1].lng, quad.pins[1].lat],
          [quad.pins[2].lng, quad.pins[2].lat],
          [quad.pins[3].lng, quad.pins[3].lat],
          [quad.pins[0].lng, quad.pins[0].lat],
        ],
      ],
    },
    properties: {
      id: quad.id,
      areaSqMiles: quad.areaSqMiles,
      shape: 'quad',
    },
  }))

  return {
    type: 'FeatureCollection',
    features: [...triangleFeatures, ...quadFeatures],
  }
}

export function pinTrianglesToGeoJSON(triangles) {
  return pinShapesToGeoJSON(triangles)
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
