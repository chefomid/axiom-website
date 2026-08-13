/**
 * Human-facing official source pages, never raw API JSON endpoints.
 * @param {object | null | undefined} marker
 * @returns {string | null}
 */
export function resolveOfficialSourceUrl(marker) {
  if (!marker) return null

  if (marker.layer === 'earthquake' || marker.usgsUrl) {
    return sanitizePublicUrl(marker.usgsUrl)
  }

  if (marker.layer === 'weather' || marker.nwsUrl) {
    return resolveNwsPublicUrl(marker)
  }

  if (marker.layer === 'flood' || marker.femaUrl) {
    return resolveFemaPublicUrl(marker)
  }

  if (marker.layer === 'wildfire') {
    return resolveWildfirePublicUrl(marker)
  }

  return sanitizePublicUrl(
    marker.usgsUrl ?? marker.nwsUrl ?? marker.femaUrl ?? marker.officialUrl,
  )
}

function sanitizePublicUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('http')) return null
  if (/api\.weather\.gov\/alerts\//i.test(url)) return null
  return url
}

function resolveNwsPublicUrl(marker) {
  const props = marker.raw ?? {}
  const ugc = props?.geocode?.UGC?.[0] ?? props?.geocode?.ugc?.[0]
  if (ugc) {
    return `https://forecast.weather.gov/MapClick.php?zone=${encodeURIComponent(ugc)}`
  }
  return 'https://www.weather.gov/warnings'
}

function resolveFemaPublicUrl(marker) {
  const lat = marker.lat
  const lng = marker.lng
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://msc.fema.gov/portal/search?AddressQuery=${lat},${lng}`
  }
  return 'https://msc.fema.gov/portal/home'
}

const UNIQUE_FIRE_ID = /^20\d{2}-[A-Z0-9]+-\d+$/i

function firmsMapUrl(lat, lng, zoom = 11) {
  return `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng},${lat},${zoom}z`
}

function isGenericWildfireHome(url) {
  if (typeof url !== 'string') return true
  const bare = url.split('#')[0].replace(/\/$/, '')
  return (
    /^https:\/\/firms\.modaps\.eosdis\.nasa\.gov\/map$/i.test(bare) ||
    /^https:\/\/eonet\.gsfc\.nasa\.gov$/i.test(bare) ||
    /^https:\/\/data-nifc\.opendata\.arcgis\.com$/i.test(bare) ||
    /eonet\.gsfc\.nasa\.gov\/api\//i.test(url)
  )
}

function uniqueFireIdFrom(marker) {
  const raw = marker.raw ?? {}
  const candidates = [
    raw.UniqueFireIdentifier,
    raw.uniqueFireIdentifier,
    marker.label,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && UNIQUE_FIRE_ID.test(value.trim())) return value.trim()
  }
  const fromIrwin = String(marker.officialUrl ?? '').match(
    /irwin\.doi\.gov\/observer\/incidents\/(20\d{2}-[A-Z0-9]+-\d+)/i,
  )
  if (fromIrwin) return fromIrwin[1]
  return null
}

function firstIncidentSourceUrl(marker) {
  const sources = marker.raw?.sources
  if (!Array.isArray(sources)) return null
  for (const source of sources) {
    const url = sanitizePublicUrl(source?.url)
    if (url && !isGenericWildfireHome(url)) return url
  }
  return null
}

function resolveWildfirePublicUrl(marker) {
  const uniqueId = uniqueFireIdFrom(marker)
  if (uniqueId) return `https://irwin.doi.gov/observer/incidents/${uniqueId}`

  const sourceUrl = firstIncidentSourceUrl(marker)
  if (sourceUrl) return sourceUrl

  const official = sanitizePublicUrl(marker.officialUrl)
  if (official && !isGenericWildfireHome(official)) return official

  const lat = Number(marker.lat)
  const lng = Number(marker.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return firmsMapUrl(lat, lng)

  return 'https://firms.modaps.eosdis.nasa.gov/map/'
}
