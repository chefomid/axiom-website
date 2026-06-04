/** Parse a single coordinate to a finite number or null. */
export function parseCoord(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Normalize lat/lng from common API shapes (lat/lng, lon, x/y, GeoJSON). */
export function normalizeLatLng(source) {
  if (!source || typeof source !== 'object') return null

  const fromFields = () => {
    const lat = parseCoord(source.lat ?? source.latitude ?? source.y)
    const lng = parseCoord(source.lng ?? source.lon ?? source.longitude ?? source.x)
    if (lat != null && lng != null) return { lat, lng }
    return null
  }

  const coords = source.coordinates
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = parseCoord(coords[0])
    const lat = parseCoord(coords[1])
    if (lat != null && lng != null) return { lat, lng }
  }

  return fromFields()
}

export function isValidLatLng(lat, lng) {
  return parseCoord(lat) != null && parseCoord(lng) != null
}

export function normalizeSuggestion(item) {
  if (!item?.label) return null
  const coords = normalizeLatLng(item)
  if (!coords) return null
  return { ...item, ...coords }
}
