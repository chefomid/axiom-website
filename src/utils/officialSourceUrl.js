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
  if (/inciweb\.wildfire\.gov\/accessible-view/i.test(url)) return true
  const bare = url.split('#')[0].replace(/\/$/, '')
  return (
    /^https:\/\/eonet\.gsfc\.nasa\.gov$/i.test(bare) ||
    /^https:\/\/data-nifc\.opendata\.arcgis\.com$/i.test(bare) ||
    /^https:\/\/inciweb\.wildfire\.gov$/i.test(bare)
  )
}

function isGuessedInciwebUrl(url) {
  return typeof url === 'string' && /inciweb\.wildfire\.gov\/incident-information\//i.test(url)
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

function unitFromUniqueFireId(uniqueId) {
  const parts = String(uniqueId).split('-')
  return parts.length >= 3 ? parts[1] : null
}

function stateCodeFrom(marker) {
  const poo = String(marker.raw?.POOState ?? '').toUpperCase()
  const pooMatch = poo.match(/^(?:US-)?([A-Z]{2})$/)
  if (pooMatch) return pooMatch[1]

  const uniqueId = uniqueFireIdFrom(marker)
  const unit = uniqueId ? unitFromUniqueFireId(uniqueId) : null
  if (typeof unit === 'string' && /^[A-Z]{2}/i.test(unit)) return unit.slice(0, 2).toUpperCase()
  return null
}

const STATE_WILDFIRE_INFO = {
  AK: 'https://akfireinfo.com/',
  AZ: 'https://dffm.az.gov/',
  CA: 'https://www.fire.ca.gov/incidents',
  CO: 'https://dfpc.colorado.gov/wildfire-information',
  ID: 'https://www.idl.idaho.gov/fire-management/',
  MT: 'https://dnrc.mt.gov/Forestry/Wildfire',
  NM: 'https://www.emnrd.nm.gov/sfd/',
  NV: 'https://forestry.nv.gov/',
  OR: 'https://www.oregon.gov/odf/fire/pages/default.aspx',
  TX: 'https://tfsweb.tamu.edu/Wildfires/',
  UT: 'https://utah-fire-info-utahdnr.hub.arcgis.com/',
  WA: 'https://www.dnr.wa.gov/Wildfires',
  WY: 'https://wsfd.wyo.gov/',
}

const NIFC_WFIGS_ITEM_ID = '4181a117dc9e43db8598533e29972015'

function nifcIncidentMapUrl(lat, lng) {
  const y = Number(lat)
  const x = Number(lng)
  if (!Number.isFinite(y) || !Number.isFinite(x)) return null
  return `https://www.arcgis.com/apps/mapviewer/index.html?layers=${NIFC_WFIGS_ITEM_ID}&center=${x},${y}&level=12`
}

function resolveWildfirePublicUrl(marker) {
  const sourceUrl = firstIncidentSourceUrl(marker)
  if (sourceUrl) return sourceUrl

  if (wildfireKindFromMarker(marker) === 'named') {
    const stateUrl = STATE_WILDFIRE_INFO[stateCodeFrom(marker)]
    if (stateUrl) return stateUrl
    const mapUrl = nifcIncidentMapUrl(marker.lat, marker.lng)
    if (mapUrl) return mapUrl
    return 'https://www.nifc.gov/fire-information/nfn'
  }

  const official = sanitizePublicUrl(marker.officialUrl)
  if (official && !isInaccessibleWildfireUrl(official) && !isGuessedInciwebUrl(official)) {
    return official
  }

  const lat = Number(marker.lat)
  const lng = Number(marker.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return firmsMapUrl(lat, lng)

  return 'https://firms.modaps.eosdis.nasa.gov/map/'
}
