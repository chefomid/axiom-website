import { defaultFetchHeaders, femaArcgisUrl } from '../utils/apiBase'
import { getScopeBbox, bboxToEsriEnvelope } from '../utils/scopeBbox'
import { getRiskCache, setRiskCache, riskCacheKey } from '../utils/riskCache'
import { geometryCentroid } from '../utils/geo'

const NFHL_LAYER = 28
const MAX_ZONES = 500

function zoneSeverity(fldZone) {
  const z = (fldZone ?? '').toUpperCase()
  if (z.startsWith('A') || z.startsWith('V')) return 'watch'
  if (z === 'X' || z.includes('0.2')) return 'stable'
  return 'live'
}

function arcgisFeatureToRiskEvent(feature) {
  const props = feature.properties ?? feature.attributes ?? {}
  const geometry = feature.geometry
  if (!geometry) return null

  let polygon = geometry
  if (geometry.rings) {
    polygon = { type: 'Polygon', coordinates: geometry.rings }
  }

  if (polygon.type !== 'Polygon' && polygon.type !== 'MultiPolygon') return null

  const centroid = geometryCentroid(polygon)
  if (!centroid) return null

  const fldZone = props.FLD_ZONE ?? props.fld_zone ?? 'Unknown'
  const objectId = props.OBJECTID ?? props.objectid ?? Math.random().toString(36).slice(2)

  return {
    id: `nfhl-${objectId}`,
    source: 'FEMA',
    layer: 'flood',
    geometryType: 'polygon',
    polygon,
    centroidLat: centroid.lat,
    centroidLng: centroid.lng,
    lat: centroid.lat,
    lng: centroid.lng,
    country: 'US',
    label: `NFHL-${fldZone}`,
    title: `Flood zone ${fldZone}`,
    severity: zoneSeverity(fldZone),
    timestamp: null,
    confidence: 96,
    detail: [
      `Zone ${fldZone}`,
      props.ZONE_SUBTY ? `Subtype ${props.ZONE_SUBTY}` : null,
      props.SFHA_TF === 'T' ? 'Special Flood Hazard Area' : null,
    ]
      .filter(Boolean)
      .join(' · '),
    dataSources: ['fema'],
    raw: props,
    links: {
      official: `https://msc.fema.gov/portal/search?AddressQuery=${centroid.lat},${centroid.lng}`,
    },
  }
}

export function buildNfhlRequestUrl(scopeConfig) {
  const bbox = getScopeBbox(scopeConfig)
  const envelope = bboxToEsriEnvelope(bbox)
  const params = new URLSearchParams({
    where: '1=1',
    geometry: envelope,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF,OBJECTID',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: String(MAX_ZONES),
  })
  return femaArcgisUrl(`/arcgis/rest/services/public/NFHL/MapServer/${NFHL_LAYER}/query?${params}`)
}

export function buildNfhlRasterUrl(bbox) {
  const params = new URLSearchParams({
    bbox: bboxToEsriEnvelope(bbox),
    bboxSR: '4326',
    size: '512,512',
    format: 'png',
    transparent: 'true',
    f: 'image',
    layers: `show:${NFHL_LAYER}`,
  })
  return femaArcgisUrl(`/arcgis/rest/services/public/NFHL/MapServer/export?${params}`)
}

export async function fetchFemaNfhlZones(scopeConfig, options = {}) {
  if (scopeConfig.scope === 'national' && scopeConfig.countryId !== 'US') {
    return { events: [], requestUrl: null, totalFetched: 0 }
  }

  const bbox = getScopeBbox(scopeConfig)
  const cacheKey = riskCacheKey([
    scopeConfig.scope,
    scopeConfig.countryId,
    bbox.west,
    bbox.south,
    bbox.east,
    bbox.north,
  ])

  if (!options.skipCache) {
    const cached = getRiskCache('nfhl', cacheKey)
    if (cached) return { ...cached, fromCache: true }
  }

  const url = buildNfhlRequestUrl(scopeConfig)
  const res = await fetch(url, { headers: defaultFetchHeaders(), signal: options.signal })
  if (!res.ok) throw new Error(`FEMA NFHL API error (${res.status})`)

  const data = await res.json()
  const features = data.features ?? []
  const events = features.map(arcgisFeatureToRiskEvent).filter(Boolean).slice(0, MAX_ZONES)

  const result = {
    events,
    requestUrl: url,
    totalFetched: events.length,
    rasterUrl: buildNfhlRasterUrl(bbox),
    bbox,
  }
  setRiskCache('nfhl', cacheKey, result)
  return result
}

export function nfhlToSignals(zoneMarkers, limit = 6) {
  return [...zoneMarkers]
    .filter(m => m.severity !== 'stable')
    .slice(0, limit)
    .map(marker => ({
      id: `nfhl-signal-${marker.id}`,
      severity: marker.severity,
      layer: marker.layer ?? 'flood',
      title: marker.title,
      source: 'FEMA NFHL',
      dataSources: ['fema'],
      confidence: marker.confidence,
      action: marker.action,
      markerId: marker.id,
      timestamp: marker.timestamp ?? null,
      live: true,
    }))
}
