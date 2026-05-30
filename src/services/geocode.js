const PHOTON_BASE = import.meta.env.DEV
  ? '/api/photon/api/'
  : 'https://photon.komoot.io/api/'

function formatShortLabel(props) {
  const street = [props.housenumber, props.street].filter(Boolean).join(' ')
  const locality = [props.city || props.district, props.state, props.postcode].filter(Boolean).join(', ')
  if (street && locality) return `${street}, ${locality}`
  if (street) return street
  if (locality) return locality
  return props.name || props.city || props.country || 'Selected location'
}

function dedupeResults(items) {
  const seen = new Set()
  return items.filter(item => {
    const key = `${item.label.toLowerCase()}|${item.lat.toFixed(3)}|${item.lng.toFixed(3)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function inBbox(lat, lng, bbox) {
  if (!bbox || bbox.length !== 4) return true
  const [minLon, minLat, maxLon, maxLat] = bbox
  return lng >= minLon && lng <= maxLon && lat >= minLat && lat <= maxLat
}

function matchesCountryAndBbox(props, lat, lng, countryId, bbox) {
  if (!inBbox(lat, lng, bbox)) return false
  const code = countryId?.toLowerCase()
  if (!code) return true
  const countryCode = (props.countrycode || '').toLowerCase()
  if (countryCode) return countryCode === code
  return inBbox(lat, lng, bbox)
}

/** House number alone (e.g. "825") returns junk worldwide — require a street name. */
export function isSearchableAddressQuery(query) {
  const q = query.trim()
  if (q.length < 4) return false
  return /[a-zA-Z]{2,}/.test(q)
}

/**
 * @param {string} query
 * @param {{ countryId?: string, bbox?: number[], limit?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<Array<{ id: string, label: string, lat: number, lng: number }>>}
 */
export async function searchAddresses(query, { countryId, bbox, limit = 5, signal } = {}) {
  const q = query.trim()
  if (!countryId || !isSearchableAddressQuery(q)) return []

  const url = new URL(PHOTON_BASE, window.location.origin)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(Math.max(limit * 3, 12)))
  url.searchParams.set('lang', 'en')

  if (bbox?.length === 4) {
    url.searchParams.set('bbox', bbox.join(','))
  }

  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Address lookup failed')

  const data = await res.json()
  const features = data.features ?? []

  const mapped = features
    .map((feat, index) => {
      const coords = feat.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) return null
      const props = feat.properties ?? {}
      const lat = coords[1]
      const lng = coords[0]
      if (!matchesCountryAndBbox(props, lat, lng, countryId, bbox)) return null
      return {
        id: `${props.osm_id ?? index}-${coords[0]}-${coords[1]}`,
        label: formatShortLabel(props),
        lat,
        lng,
      }
    })
    .filter(Boolean)

  return dedupeResults(mapped).slice(0, limit)
}

export function countryCenterLocation(country) {
  return {
    lat: country.center[1],
    lng: country.center[0],
    label: `${country.label} (overview)`,
  }
}

export function globalCenterLocation() {
  return {
    lat: 30,
    lng: -20,
    label: 'Global (overview)',
  }
}
