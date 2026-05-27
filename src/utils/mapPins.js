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
