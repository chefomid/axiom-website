/**
 * Human-facing official source pages — never raw API JSON endpoints.
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
    return (
      sanitizePublicUrl(marker.officialUrl) ??
      'https://firms.modaps.eosdis.nasa.gov/map/'
    )
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
