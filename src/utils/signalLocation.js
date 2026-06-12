import { COUNTRIES } from '../data/commandMapData'

/** @param {string | undefined} title e.g. "M6.7 · 44 km ESE of Ōfunato, Japan" */
export function locationFromEarthquakeTitle(title) {
  if (!title) return null
  const separator = title.indexOf(' · ')
  if (separator === -1) return null
  return title.slice(separator + 3).trim() || null
}

/** @param {{ place?: string, title?: string }} marker */
export function locationFromEarthquakeMarker(marker) {
  if (marker.place?.trim()) return marker.place.trim()
  return locationFromEarthquakeTitle(marker.title)
}

/** @param {{ raw?: { areaDesc?: string }, detail?: string }} marker */
export function locationFromNwsMarker(marker) {
  const areaDesc = marker.raw?.areaDesc?.trim()
  if (areaDesc) {
    const first = areaDesc.split(';')[0]?.trim()
    return first || areaDesc
  }

  if (marker.detail) {
    const parts = marker.detail.split(' · ')
    const areaPart = parts.find(
      part =>
        part &&
        !part.startsWith('Severity:') &&
        !part.startsWith('Urgency:') &&
        !part.includes('Your location is inside'),
    )
    if (areaPart && areaPart.length > 3) return areaPart
  }

  return null
}

/** @param {{ lat?: number, lng?: number, country?: string | null }} marker */
export function locationFromCoordinates(marker) {
  const { lat, lng } = marker
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const countryLabel = marker.country
    ? COUNTRIES.find(c => c.id === marker.country)?.label
    : null

  const latAbs = Math.abs(lat).toFixed(2)
  const lngAbs = Math.abs(lng).toFixed(2)
  const latHem = lat >= 0 ? 'N' : 'S'
  const lngHem = lng >= 0 ? 'E' : 'W'
  const coords = `${latAbs}°${latHem}, ${lngAbs}°${lngHem}`

  return countryLabel ? `${coords} · ${countryLabel}` : coords
}

/** @param {{ layer?: string, place?: string, title?: string, raw?: object, detail?: string, lat?: number, lng?: number, country?: string | null }} marker */
export function locationLabelForMarker(marker) {
  if (!marker) return null

  switch (marker.layer) {
    case 'earthquake':
      return locationFromEarthquakeMarker(marker)
    case 'weather':
      return locationFromNwsMarker(marker)
    case 'wildfire':
    case 'flood':
      return locationFromCoordinates(marker)
    default:
      return locationFromCoordinates(marker)
  }
}

/** @param {{ mag?: number, title?: string, layer?: string }} marker */
export function headlineForMarker(marker) {
  if (marker.layer === 'earthquake' && marker.mag != null) {
    return `M${marker.mag.toFixed(1)}`
  }
  return marker.title ?? 'Event'
}
