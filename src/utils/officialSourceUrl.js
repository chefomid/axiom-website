import { wildfireKindFromMarker } from './wildfireDisplay.js'

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

function firmsMapUrl(lat, lng, zoom = 11) {
  return `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng},${lat},${zoom}z`
}

function isFirmsMapUrl(url) {
  return typeof url === 'string' && /firms\.modaps\.eosdis\.nasa\.gov/i.test(url)
}

function isInaccessibleWildfireUrl(url) {
  if (typeof url !== 'string') return true
  if (/irwin\.doi\.gov/i.test(url)) return true
  if (/eonet\.gsfc\.nasa\.gov\/api\//i.test(url)) return true
  if (isFirmsMapUrl(url)) return true
  const bare = url.split('#')[0].replace(/\/$/, '')
  return (
    /^https:\/\/eonet\.gsfc\.nasa\.gov$/i.test(bare) ||
    /^https:\/\/data-nifc\.opendata\.arcgis\.com$/i.test(bare)
  )
}

function firstIncidentSourceUrl(marker) {
  const sources = marker.raw?.sources
  if (!Array.isArray(sources)) return null
  for (const source of sources) {
    const url = sanitizePublicUrl(source?.url)
    if (url && !isInaccessibleWildfireUrl(url)) return url
  }
  return null
}

function uniqueFireIdFrom(marker) {
  const raw = marker.raw ?? {}
  const direct = raw.UniqueFireIdentifier ?? raw.uniqueFireIdentifier
  if (typeof direct === 'string' && /20\d{2}-[A-Z0-9]+-\d+/i.test(direct.trim())) {
    return direct.trim()
  }
  const haystacks = [
    marker.officialUrl,
    ...(Array.isArray(raw.sources) ? raw.sources.map(s => s?.url) : []),
    marker.id,
  ]
  for (const value of haystacks) {
    const match = String(value ?? '').match(/20\d{2}-[A-Z0-9]+-\d+/i)
    if (match) return match[0]
  }
  return null
}

function incidentNameFrom(marker) {
  const raw = marker.raw ?? {}
  const named = raw.IncidentName ?? marker.title ?? marker.label
  if (typeof named !== 'string') return null
  return named
    .replace(/^wildfire\s+/i, '')
    .split(',')[0]
    .trim()
}

function slugifyIncidentName(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function unitFromUniqueFireId(uniqueId) {
  const parts = String(uniqueId).split('-')
  return parts.length >= 3 ? parts[1].toLowerCase() : null
}

function inciwebIncidentUrl(marker) {
  const uniqueId = uniqueFireIdFrom(marker)
  const name = incidentNameFrom(marker)
  const unit = uniqueId ? unitFromUniqueFireId(uniqueId) : null
  const slug = name ? slugifyIncidentName(name) : ''
  if (unit && slug) return `https://inciweb.wildfire.gov/incident-information/${unit}-${slug}`
  if (name) {
    return `https://inciweb.wildfire.gov/accessible-view?combine=${encodeURIComponent(name)}`
  }
  return null
}

function resolveWildfirePublicUrl(marker) {
  const sourceUrl = firstIncidentSourceUrl(marker)
  if (sourceUrl) return sourceUrl

  if (wildfireKindFromMarker(marker) === 'named') {
    const incidentUrl = inciwebIncidentUrl(marker)
    if (incidentUrl) return incidentUrl
  }

  const official = sanitizePublicUrl(marker.officialUrl)
  if (official && !isInaccessibleWildfireUrl(official)) return official

  const lat = Number(marker.lat)
  const lng = Number(marker.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return firmsMapUrl(lat, lng)

  return 'https://firms.modaps.eosdis.nasa.gov/map/'
}
