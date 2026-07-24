import { isSearchableAddressQuery, withGeocodeTimeout } from './geocodeQuery'

export {
  GEOCODE_FETCH_TIMEOUT_MS,
  isPropertyAddressQuery,
  isSearchableAddressQuery,
  withGeocodeTimeout,
} from './geocodeQuery'

const PHOTON_BASE = import.meta.env.DEV
  ? '/api/photon/api/'
  : 'https://photon.komoot.io/api/'

const HOUSE_NUMBER_RE = /^\s*(\d+[\w/-]*)/
const MAX_REFINE_DRIFT_M = 400

async function fetchGeocodeJson(url, { signal, headers } = {}) {
  const timed = withGeocodeTimeout(signal)
  try {
    const res = await fetch(url, { signal: timed.signal, headers })
    return res.ok ? res : null
  } catch {
    return null
  } finally {
    timed.cleanup()
  }
}

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

    const labelKey = item.label.toLowerCase().replace(/\s+/g, ' ').trim()
    const coordKey = `${pair.lat.toFixed(4)}|${pair.lng.toFixed(4)}`
    const fingerprint = normalizeAddressFingerprint(item.label)

    if (seen.has(`label:${labelKey}`)) return false
    if (seen.has(`fp:${fingerprint}`)) return false
    if (seen.has(`coord:${coordKey}`)) return false

    seen.add(`label:${labelKey}`)
    seen.add(`fp:${fingerprint}`)
    seen.add(`coord:${coordKey}`)
    return true
  })
}

const DIRECTION_ALIASES = [
  [/\bnorthwest\b|\bnw\b/g, 'nw'],
  [/\bsouthwest\b|\bsw\b/g, 'sw'],
  [/\bnortheast\b|\bne\b/g, 'ne'],
  [/\bsoutheast\b|\bse\b/g, 'se'],
  [/\bnorth\b|\bn\b/g, 'n'],
  [/\bsouth\b|\bs\b/g, 's'],
  [/\beast\b|\be\b/g, 'e'],
  [/\bwest\b|\bw\b/g, 'w'],
]

const STREET_ALIASES = [
  [/\bstreet\b|\bst\b/g, 'st'],
  [/\bavenue\b|\bave\b/g, 'ave'],
  [/\broad\b|\brd\b/g, 'rd'],
  [/\bboulevard\b|\bblvd\b/g, 'blvd'],
  [/\bdrive\b|\bdr\b/g, 'dr'],
  [/\blane\b|\bln\b/g, 'ln'],
  [/\bcourt\b|\bct\b/g, 'ct'],
  [/\bplace\b|\bpl\b/g, 'pl'],
  [/\bterrace\b|\bter\b/g, 'ter'],
  [/\bparkway\b|\bpkwy\b/g, 'pkwy'],
  [/\bhighway\b|\bhwy\b/g, 'hwy'],
  [/\bcircle\b|\bcir\b/g, 'cir'],
]

function normalizeAddressFingerprint(label) {
  const hn = houseNumber(label) ?? ''
  const zip = String(label ?? '').match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? ''

  let text = String(label ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  for (const [pattern, token] of DIRECTION_ALIASES) text = text.replace(pattern, ` ${token} `)
  for (const [pattern, token] of STREET_ALIASES) text = text.replace(pattern, ` ${token} `)
  text = text
    .replace(/\boregon\b|\bor\b/g, ' or ')
    .replace(/\bportland\b/g, ' portland ')
    .replace(/\s+/g, ' ')
    .trim()

  return `${hn}|${zip}|${text}`
}

export function inBbox(lat, lng, bbox) {
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

  const headers = { Accept: 'application/json' }
  let res = await fetchGeocodeJson(url, { signal, headers })
  if (!res && import.meta.env.DEV && PHOTON_BASE.startsWith('/api/photon')) {
    const direct = new URL('https://photon.komoot.io/api/')
    direct.search = url.searchParams.toString()
    res = await fetchGeocodeJson(direct, { signal, headers })
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

/** Census blocks browser CORS — dev uses Vite proxy; prod uses property API proxy. */
function censusLocationsUrl(kind) {
  if (import.meta.env.DEV) {
    return `/api/census/geocoder/locations/${kind}`
  }
  const apiBase = import.meta.env.VITE_PROPERTY_API_URL?.replace(/\/$/, '')
  if (apiBase) {
    return `${apiBase}/geocode/census/${kind}`
  }
  return `/api/property/geocode/census/${kind}`
}

const CENSUS_BASE = censusLocationsUrl('onelineaddress')

async function fetchCensusMatches(address, { signal } = {}) {
  const url = new URL(CENSUS_BASE, window.location.origin)
  url.searchParams.set('address', address.trim())
  url.searchParams.set('benchmark', 'Public_AR_Current')
  url.searchParams.set('format', 'json')

  const headers = { Accept: 'application/json' }
  let res = await fetchGeocodeJson(url, { signal, headers })
  if (!res && import.meta.env.DEV && CENSUS_BASE.startsWith('/api/census')) {
    const direct = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
    direct.search = url.searchParams.toString()
    res = await fetchGeocodeJson(direct, { signal, headers })
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

/** US property search, Census label + OSM building coords for accurate map pins. */
export async function searchUsPropertyAddresses(
  query,
  { countryId = 'US', bbox, limit = 5, signal, refine = limit === 1 } = {},
) {
  const q = query.trim()
  if (!isSearchableAddressQuery(q)) return []

  const opts = { countryId, bbox, limit, signal }

  try {
    const census = await searchCensusUs(q, { signal })
    if (census.length) {
      if (refine) {
        const refined = await Promise.all(
          census.slice(0, limit).map(item => refineWithBuildingCoords(q, item, opts)),
        )
        return dedupeResults(refined).slice(0, limit)
      }
      return dedupeResults(census).slice(0, limit)
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

/** Fast US autocomplete, Census preferred, Photon fills gaps; aggressive dedupe. */
export async function searchUsAddressSuggestions(
  query,
  { countryId = 'US', bbox, limit = 5, signal } = {},
) {
  const q = query.trim()
  if (!isSearchableAddressQuery(q, 3)) return []

  const opts = { countryId, bbox, limit: Math.max(limit, 6), signal }

  const runPhoton = searchAddresses(q, opts).catch(err => {
    if (err.name === 'AbortError') throw err
    return []
  })

  const runCensus =
    q.length >= 5
      ? searchCensusUs(q, { signal }).catch(err => {
          if (err.name === 'AbortError') throw err
          return []
        })
      : Promise.resolve([])

  const [census, photon] = await Promise.all([runCensus, runPhoton])
  return dedupeResults([...census, ...photon]).slice(0, limit)
}

const CENSUS_REVERSE_BASE = censusLocationsUrl('coordinates')

/**
 * Reverse-geocode GPS coordinates to a US property address.
 * Keeps the pin anchored to the device position unless a building-level match
 * is within MAX_REFINE_DRIFT_M of those coordinates.
 */
export async function resolveUsLocationFromCoords(
  lat,
  lng,
  { signal, bbox, countryId = 'US' } = {},
) {
  const gps = toCoordPair(lat, lng)
  if (!gps) return null
  if (!inBbox(gps.lat, gps.lng, bbox)) return null

  const reversed = await reverseGeocodeUs(gps.lat, gps.lng, { signal, bbox })
  if (!reversed?.label) {
    return {
      id: `geo-${gps.lat}-${gps.lng}`,
      label: `Current location (${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)})`,
      lat: gps.lat,
      lng: gps.lng,
    }
  }

  return refineWithBuildingCoords(
    reversed.label,
    { ...reversed, lat: gps.lat, lng: gps.lng },
    { countryId, bbox, signal },
  )
}

/** Reverse geocode US coordinates to a street address label. */
export async function reverseGeocodeUs(lat, lng, { signal, bbox } = {}) {
  const pair = toCoordPair(lat, lng)
  if (!pair) return null
  if (!inBbox(pair.lat, pair.lng, bbox)) return null

  const headers = { Accept: 'application/json' }
  const censusUrl = new URL(CENSUS_REVERSE_BASE, window.location.origin)
  censusUrl.searchParams.set('x', String(pair.lng))
  censusUrl.searchParams.set('y', String(pair.lat))
  censusUrl.searchParams.set('benchmark', 'Public_AR_Current')
  censusUrl.searchParams.set('format', 'json')

  let res = await fetchGeocodeJson(censusUrl, { signal, headers })
  if (!res && import.meta.env.DEV && CENSUS_REVERSE_BASE.startsWith('/api/census')) {
    const direct = new URL('https://geocoding.geo.census.gov/geocoder/locations/coordinates')
    direct.search = censusUrl.searchParams.toString()
    res = await fetchGeocodeJson(direct, { signal, headers })
  }

  if (res) {
    try {
      const match = (await res.json()).result?.addressMatches?.[0]
      const coords = match?.coordinates
      const matched = coords ? toCoordPair(coords.y, coords.x) : pair
      if (match?.matchedAddress && matched) {
        return {
          id: `reverse-${matched.lat}-${matched.lng}`,
          label: match.matchedAddress,
          lat: matched.lat,
          lng: matched.lng,
        }
      }
    } catch {
      /* fall through to Photon */
    }
  }

  const photonUrl = new URL(
    import.meta.env.DEV ? '/api/photon/reverse' : 'https://photon.komoot.io/reverse',
    window.location.origin,
  )
  photonUrl.searchParams.set('lat', String(pair.lat))
  photonUrl.searchParams.set('lon', String(pair.lng))
  photonUrl.searchParams.set('lang', 'en')

  res = await fetchGeocodeJson(photonUrl, { signal, headers })
  if (!res && import.meta.env.DEV) {
    const direct = new URL('https://photon.komoot.io/reverse')
    direct.search = photonUrl.searchParams.toString()
    res = await fetchGeocodeJson(direct, { signal, headers })
  }

  if (!res) {
    return {
      id: `coords-${pair.lat}-${pair.lng}`,
      label: `Current location (${pair.lat.toFixed(4)}, ${pair.lng.toFixed(4)})`,
      lat: pair.lat,
      lng: pair.lng,
    }
  }

  try {
    const feature = (await res.json()).features?.[0]
    const coords = feature?.geometry?.coordinates
    const props = feature?.properties ?? {}
    const matched = Array.isArray(coords) ? toCoordPair(coords[1], coords[0]) : pair
    if (matched) {
      return {
        id: `reverse-${matched.lat}-${matched.lng}`,
        label: formatShortLabel(props) || `Current location (${matched.lat.toFixed(4)}, ${matched.lng.toFixed(4)})`,
        lat: matched.lat,
        lng: matched.lng,
      }
    }
  } catch {
    /* ignore */
  }

  return {
    id: `coords-${pair.lat}-${pair.lng}`,
    label: `Current location (${pair.lat.toFixed(4)}, ${pair.lng.toFixed(4)})`,
    lat: pair.lat,
    lng: pair.lng,
  }
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

const CITY_PLACE_TYPES = new Set([
  'city',
  'town',
  'village',
  'municipality',
  'borough',
  'hamlet',
  'suburb',
  'locality',
])

function formatCityStateLabel(props) {
  const city = props.city || props.name || props.district
  if (!city) return null
  const state = props.state
  if (state) return `${city}, ${state}`
  if (props.country) return `${city}, ${props.country}`
  return city
}

/** Minimum characters before city/state autocomplete runs. */
export function isSearchableCityQuery(query, minLength = 2) {
  return query.trim().length >= minLength
}

/**
 * US city/state autocomplete for forms (Photon, city layer).
 * @returns {Promise<Array<{ id: string, label: string, lat: number, lng: number }>>}
 */
export async function searchCityStateLocations(query, { countryId = 'us', limit = 6, signal } = {}) {
  const q = query.trim()
  if (!isSearchableCityQuery(q)) return []

  const url = new URL(PHOTON_BASE, window.location.origin)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(Math.max(limit * 3, 12)))
  url.searchParams.set('lang', 'en')
  url.searchParams.set('layer', 'city')

  const headers = { Accept: 'application/json' }
  let res = await fetchGeocodeJson(url, { signal, headers })
  if (!res && import.meta.env.DEV && PHOTON_BASE.startsWith('/api/photon')) {
    const direct = new URL('https://photon.komoot.io/api/')
    direct.search = url.searchParams.toString()
    res = await fetchGeocodeJson(direct, { signal, headers })
  }
  if (!res) return []

  let data
  try {
    data = await res.json()
  } catch {
    return []
  }

  const code = countryId?.toLowerCase()
  const seenLabels = new Set()

  const mapped = (data.features ?? [])
    .map((feat, index) => {
      const coords = feat.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) return null
      const props = feat.properties ?? {}
      const countryCode = (props.countrycode || '').toLowerCase()
      if (code && countryCode && countryCode !== code) return null

      const placeType = String(props.type ?? props.osm_value ?? '').toLowerCase()
      if (placeType && !CITY_PLACE_TYPES.has(placeType) && !props.city) return null

      const label = formatCityStateLabel(props)
      if (!label) return null

      const pair = toCoordPair(coords[1], coords[0])
      if (!pair) return null

      const labelKey = label.toLowerCase()
      if (seenLabels.has(labelKey)) return null
      seenLabels.add(labelKey)

      return {
        id: `${props.osm_id ?? index}-${coords[0]}-${coords[1]}`,
        label,
        lat: pair.lat,
        lng: pair.lng,
      }
    })
    .filter(Boolean)

  return mapped.slice(0, limit)
}
