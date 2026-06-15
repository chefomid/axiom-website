/** Customer-facing labels for COPE field source buckets (not internal adapter IDs). */
const COPE_SOURCE_LABELS = {
  web_search: 'Public records search',
  assessor_crawl: 'County assessor records',
  permit_crawl: 'Building permits',
  county_parcel: 'County parcel records',
  attom: 'ATTOM property data',
  attom_hazard: 'ATTOM hazard data',
  corelogic: 'CoreLogic property data',
  melissa: 'Melissa property data',
  rentcast: 'RentCast property data',
  regrid: 'Regrid parcel data',
  vision_construction: 'Property imagery analysis',
  geocoder: 'Address verification',
  fema_nfhl: 'FEMA flood maps',
  nws: 'National Weather Service',
  usgs: 'USGS hazard data',
  nasa_eonet: 'NASA hazard events',
  open_meteo: 'Weather data',
  osm: 'OpenStreetMap',
  fire_station_gis: 'Nearby fire stations',
  hydrant_gis: 'Fire hydrant proximity',
  poi_exposure: 'Nearby exposure points',
  epa_echo: 'EPA environmental records',
  firststreet: 'First Street hazard scores',
}

export function formatCopeSourceLabel(source) {
  if (source == null || source === '') return ''
  const key = String(source).trim().toLowerCase()
  if (COPE_SOURCE_LABELS[key]) return COPE_SOURCE_LABELS[key]
  return String(source)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}
