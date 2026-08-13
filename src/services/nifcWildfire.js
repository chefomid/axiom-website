import { getScopeBbox, pointInBbox } from '../utils/scopeBbox'

/** NIFC WFIGS current wildland fire incident points (IRWIN-backed, free). */
const NIFC_CURRENT_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query'

const OUT_FIELDS = [
  'IncidentName',
  'IncidentSize',
  'PercentContained',
  'FireDiscoveryDateTime',
  'InitialLatitude',
  'InitialLongitude',
  'IncidentTypeCategory',
  'UniqueFireIdentifier',
  'POOState',
  'POOCity',
  'POOCounty',
].join(',')

function acresSeverity(acres) {
  if (!Number.isFinite(acres)) return 'live'
  if (acres >= 10000) return 'critical'
  if (acres >= 1000) return 'watch'
  return 'live'
}

function discoveryTimestamp(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return null
  try {
    return new Date(Number(ms)).toISOString()
  } catch {
    return null
  }
}

function featureToRiskEvent(feature) {
  const props = feature?.properties ?? {}
  const coords = feature?.geometry?.coordinates
  const lng = Array.isArray(coords) ? Number(coords[0]) : Number(props.InitialLongitude)
  const lat = Array.isArray(coords) ? Number(coords[1]) : Number(props.InitialLatitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const acres = Number(props.IncidentSize)
  const category = String(props.IncidentTypeCategory || 'WF').toUpperCase()
  const name = props.IncidentName?.trim() || 'Wildland fire incident'
  const contained =
    props.PercentContained != null && Number.isFinite(Number(props.PercentContained))
      ? `${Number(props.PercentContained)}% contained`
      : null
  const place = [props.POOCity, props.POOCounty, props.POOState]
    .filter(Boolean)
    .join(', ')

  return {
    id: `nifc-${props.UniqueFireIdentifier || props.OBJECTID || `${lat}-${lng}`}`,
    source: 'NIFC',
    layer: 'wildfire',
    geometryType: 'point',
    lat,
    lng,
    country: 'US',
    label: props.UniqueFireIdentifier || name,
    title: name,
    severity: acresSeverity(acres),
    timestamp: discoveryTimestamp(props.FireDiscoveryDateTime),
    confidence: category === 'WF' ? 92 : 80,
    detail: [
      category === 'RX' ? 'Prescribed fire' : category === 'CX' ? 'Incident complex' : 'Wildfire',
      Number.isFinite(acres) ? `${Math.round(acres).toLocaleString()} acres` : null,
      contained,
      place || null,
      'NIFC WFIGS / IRWIN',
    ]
      .filter(Boolean)
      .join(' · '),
    dataSources: ['nasa'],
    provider: 'nifc',
    raw: props,
    links: {
      official: props.UniqueFireIdentifier
        ? `https://irwin.doi.gov/observer/incidents/${props.UniqueFireIdentifier}`
        : `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng},${lat},11z`,
    },
  }
}

/**
 * Fetch current NIFC wildland fire incidents in the active scope bbox.
 * Free ArcGIS FeatureServer, no API key.
 */
export async function fetchNifcWildfires(scopeConfig, options = {}) {
  const bbox = getScopeBbox(scopeConfig)
  const params = new URLSearchParams({
    where: "IncidentTypeCategory IN ('WF','CX','RX')",
    outFields: OUT_FIELDS,
    outSR: '4326',
    returnGeometry: 'true',
    f: 'geojson',
    resultRecordCount: '500',
  })

  if (scopeConfig.scope === 'local' && scopeConfig.userLocation) {
    params.set('geometry', `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`)
    params.set('geometryType', 'esriGeometryEnvelope')
    params.set('inSR', '4326')
    params.set('spatialRel', 'esriSpatialRelIntersects')
  }

  const requestUrl = `${NIFC_CURRENT_URL}?${params}`
  const res = await fetch(requestUrl, { signal: options.signal })
  if (!res.ok) throw new Error(`NIFC WFIGS API error (${res.status})`)

  const data = await res.json()
  if (data.error) {
    throw new Error(data.error?.message || 'NIFC WFIGS query failed')
  }

  const events = (data.features ?? [])
    .map(featureToRiskEvent)
    .filter(Boolean)
    .filter(e => scopeConfig.scope !== 'local' || pointInBbox(e.lat, e.lng, bbox))

  return {
    events,
    requestUrl,
    totalFetched: events.length,
    provider: 'nifc',
  }
}
