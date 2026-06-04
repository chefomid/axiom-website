const PHOTON_BASE = import.meta.env.DEV
  ? '/api/photon/api/'
  : 'https://photon.komoot.io/api/'

const HOUSE_NUMBER_RE = /^\s*(\d+[\w/-]*)/
const MAX_REFINE_DRIFT_M = 400

function formatShortLabel(props) {
  const street = [props.housenumber, props.street].filter(Boolean).join(' ')
  const locality = [props.city || props.district, props.state, props.postcode].filter(Boolean).join(', ')
  if (street && locality) return `${street}, ${locality}`
  if (street) return street
  if (locality) return locality
  return props.name || props.city || props.country || 'Selected location'
}

function houseNumber(text) {
  const match = HOUSE_NUMBER_RE.exec((text ?? '').trim())
  return match?.[1] ?? null
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * 111_000
  const dLng = (lng2 - lng1) * 111_000 * Math.cos((lat1 * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

function scorePhotonFeature(props, query) {
  const wantHn = houseNumber(query)
  const wantBase = wantHn?.split('-')[0]
  const hn = String(props.housenumber ?? '')
  const osmType = String(props.type ?? props.osm_value ?? '')
  let score = 0
  if (wantHn && hn === wantHn) score += 12
  else if (wantBase && hn.startsWith(wantBase)) score += 7
  if (['house', 'building', 'residential', 'detached'].includes(osmType)) score += 4
  if (props.street) score += 2
  if ((props.countrycode ?? '').toLowerCase() === 'us') score += 1
  return score
}

function parseCoord(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function isValidCoordPair(lat, lng) {
  return parseCoord(lat) != null && parseCoord(lng) != null
}

function toCoordPair(lat, lng) {
  const la = parseCoord(lat)
  const ln = parseCoord(lng)
  if (la == null || ln == null) return null
  return { lat: la, lng: ln }
}

function dedupeResults(items) {
  const seen = new Set()
  return items.filter(item => {
    const pair = toCoordPair(item?.lat, item?.lng)
    if (!item?.label || !pair) return false
    const key = `${item.label.toLowerCase()}|${pair.lat.toFixed(3)}|${pair.lng.toFixed(3)}`
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
  return bbox?.length === 4 ? inBbox(lat, lng, bbox) : false
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

  const fetchPhoton = async target => {
    try {
      const res = await fetch(target, { signal, headers: { Accept: 'application/json' } })
      if (res.ok) return res
    } catch {
      /* try fallback */
    }
    return null
  }

  let res = await fetchPhoton(url)
  if (!res && import.meta.env.DEV && PHOTON_BASE.startsWith('/api/photon')) {
    const direct = new URL('https://photon.komoot.io/api/')
    direct.search = url.searchParams.toString()
    res = await fetchPhoton(direct)
  }
  if (!res) return []

  let data
  try {
    data = await res.json()
  } catch {
    return []
  }
  const features = data.features ?? []

  const mapped = features
    .map((feat, index) => {
      const coords = feat.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) return null
      const props = feat.properties ?? {}
      const pair = toCoordPair(coords[1], coords[0])
      if (!pair || !matchesCountryAndBbox(props, pair.lat, pair.lng, countryId, bbox)) return null
      return {
        id: `${props.osm_id ?? index}-${coords[0]}-${coords[1]}`,
        label: formatShortLabel(props),
        lat: pair.lat,
        lng: pair.lng,
        score: scorePhotonFeature(props, q),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map(({ score: _score, ...item }) => item)

  return dedupeResults(mapped).slice(0, limit)
}

const CENSUS_BASE = import.meta.env.DEV
  ? '/api/census/geocoder/locations/onelineaddress'
  : 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress'

async function fetchCensusMatches(address, { signal } = {}) {
  const url = new URL(CENSUS_BASE, window.location.origin)
  url.searchParams.set('address', address.trim())
  url.searchParams.set('benchmark', 'Public_AR_Current')
  url.searchParams.set('format', 'json')

  const fetchCensus = async target => {
    try {
      const res = await fetch(target, { signal, headers: { Accept: 'application/json' } })
      if (res.ok) return res
    } catch {
      /* try fallback */
    }
    return null
  }

  let res = await fetchCensus(url)
  if (!res && import.meta.env.DEV && CENSUS_BASE.startsWith('/api/census')) {
    const direct = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
    direct.search = url.searchParams.toString()
    res = await fetchCensus(direct)
  }
  if (!res) return []

  let matches
  try {
    matches = (await res.json()).result?.addressMatches ?? []
  } catch {
    return []
  }
  return matches
    .map((match, index) => {
      const coords = match.coordinates
      if (coords?.x == null || coords?.y == null) return null
      const pair = toCoordPair(coords.y, coords.x)
      if (!pair) return null
      return {
        id: `census-${index}-${coords.x}-${coords.y}`,
        label: match.matchedAddress,
        lat: pair.lat,
        lng: pair.lng,
      }
    })
    .filter(Boolean)
}

async function searchCensusUs(query, { signal } = {}) {
  let matches = await fetchCensusMatches(query, { signal })
  if (!matches.length && !/\b(US|USA|\d{5})\b/i.test(query)) {
    matches = await fetchCensusMatches(`${query.trim()}, United States`, { signal })
  }
  return matches
}

async function refineWithBuildingCoords(query, item, { countryId, bbox, signal } = {}) {
  const base = toCoordPair(item?.lat, item?.lng)
  if (!base) return item
  try {
    const photon = await searchAddresses(query, { countryId, bbox, limit: 8, signal })
    const wantHn = houseNumber(query) || houseNumber(item.label)
    const wantBase = wantHn?.split('-')[0]
    const match =
      photon.find(row => {
        const hn = houseNumber(row.label)
        return wantHn && hn && hn.split('-')[0] === wantBase
      }) ?? photon[0]
    const matched = toCoordPair(match?.lat, match?.lng)
    if (!matched) return { ...item, ...base }
    const drift = distanceMeters(base.lat, base.lng, matched.lat, matched.lng)
    if (drift <= MAX_REFINE_DRIFT_M) {
      return { ...item, lat: matched.lat, lng: matched.lng }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err
  }
  return { ...item, ...base }
}

/** US property search — Census label + OSM building coords for accurate map pins. */
export async function searchUsPropertyAddresses(
  query,
  { countryId = 'US', bbox, limit = 5, signal } = {},
) {
  const q = query.trim()
  if (!isSearchableAddressQuery(q)) return []

  const opts = { countryId, bbox, limit, signal }

  try {
    const census = await searchCensusUs(q, { signal })
    if (census.length) {
      const refined = await Promise.all(
        census.map(item => refineWithBuildingCoords(q, item, opts)),
      )
      return dedupeResults(refined).slice(0, limit)
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err
  }

  try {
    const photon = await searchAddresses(q, opts)
    if (photon.length) return photon
  } catch (err) {
    if (err.name === 'AbortError') throw err
  }

  return []
}

/** Resolve a single US address to coordinates for map placement. */
export async function resolveUsAddressCoords(query, options = {}) {
  const results = await searchUsPropertyAddresses(query, { ...options, limit: 1 })
  return results[0] ?? null
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
