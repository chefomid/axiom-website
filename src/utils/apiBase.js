const USER_AGENT = 'AXIOM-PublicDataCommand/1.0 (public-data-command)'

export function nwsApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) return `/api/nws${normalized}`
  return `https://api.weather.gov${normalized}`
}

export function femaArcgisUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) return `/api/fema${normalized}`
  return `https://hazards.fema.gov${normalized}`
}

export function firmsApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) return `/api/firms${normalized}`
  return `https://firms.modaps.eosdis.nasa.gov${normalized}`
}

export function airNowApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) return `/api/airnow${normalized}`
  return `https://www.airnowapi.org${normalized}`
}

export function defaultFetchHeaders(extra = {}) {
  return {
    Accept: 'application/json, application/geo+json',
    'User-Agent': USER_AGENT,
    ...extra,
  }
}
