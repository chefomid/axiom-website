const ESRI_EXPORT =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'

/** Cardinal headings for Embed API (no Static API cost). */
export const STREET_HEADINGS = [0, 90, 180, 270]

export const STREET_HEADING_LABELS = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }

export const STREET_HEADING_STEP = 45
export const STREET_PITCH_STEP = 12
export const STREET_FOV_STEP = 10
export const STREET_PITCH_MIN = -30
export const STREET_PITCH_MAX = 30
export const STREET_FOV_MIN = 55
export const STREET_FOV_MAX = 100

export function normalizeHeading(deg) {
  const n = Number(deg)
  if (!Number.isFinite(n)) return 0
  return ((Math.round(n) % 360) + 360) % 360
}

export function stepHeading(heading, delta) {
  return normalizeHeading(heading + delta)
}

export function clampPitch(pitch) {
  return Math.min(STREET_PITCH_MAX, Math.max(STREET_PITCH_MIN, pitch))
}

export function clampFov(fov) {
  return Math.min(STREET_FOV_MAX, Math.max(STREET_FOV_MIN, fov))
}

export function googleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''
}

/** Esri World Imagery static export centered on a pin. */
export function esriSatelliteImageUrl(lat, lng, width = 720, height = 540) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  const pad = 0.00028
  const bbox = [ln - pad, la - pad, ln + pad, la + pad].join(',')
  const params = new URLSearchParams({
    bbox,
    bboxSR: '4326',
    imageSR: '4326',
    size: `${width},${height}`,
    format: 'jpg',
    f: 'image',
  })
  return `${ESRI_EXPORT}?${params}`
}

export function googleStreetViewEmbedUrl(lat, lng, key, { heading = 0, pitch = 0, fov = 85 } = {}) {
  if (!key) return null
  const params = new URLSearchParams({
    key,
    location: `${lat},${lng}`,
    heading: String(normalizeHeading(heading)),
    pitch: String(clampPitch(pitch)),
    fov: String(clampFov(fov)),
  })
  return `https://www.google.com/maps/embed/v1/streetview?${params}`
}

/** Metadata SKU, unlimited free; used before loading the Embed panorama. */
export async function googleStreetViewAvailable(lat, lng, key) {
  if (!key) return false
  const params = new URLSearchParams({ location: `${lat},${lng}`, key })
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params}`)
    const data = await res.json()
    return data.status === 'OK'
  } catch {
    return false
  }
}

export function googleMapsStreetViewUrl(lat, lng) {
  return `https://www.google.com/maps?layer=c&cbll=${lat},${lng}`
}

export function googleMapsSatelliteUrl(lat, lng) {
  return `https://www.google.com/maps/@${lat},${lng},19z/data=!3m1!1e3`
}

export function mapillaryAppUrl(lat, lng) {
  return `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17&focus=map`
}
