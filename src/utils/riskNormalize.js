/** @typedef {import('../types/riskEvent.js').RiskEvent} RiskEvent */

/**
 * @param {RiskEvent} event
 */
export function toRiskPoint(event) {
  const lat = event.lat ?? event.centroidLat
  const lng = event.lng ?? event.centroidLng
  if (lat == null || lng == null) return null

  return {
    id: event.id,
    lng,
    lat,
    country: event.country ?? null,
    label: event.label,
    layer: event.layer,
    dataSources: event.dataSources,
    severity: event.severity,
    title: event.title,
    detail: event.detail,
    source: event.source,
    confidence: event.confidence,
    action: event.links?.official ? 'Open official source page' : 'View on map',
    live: true,
    usgsUrl: event.layer === 'earthquake' ? event.links?.official : undefined,
    femaUrl: event.layer === 'flood' && event.geometryType === 'point' ? event.links?.official : undefined,
    nwsUrl: event.layer === 'weather' ? event.links?.official : undefined,
    officialUrl: event.links?.official,
    timestamp: event.timestamp,
    raw: event.raw,
  }
}

/**
 * @param {RiskEvent} event
 */
export function toRiskZone(event) {
  if (!event.polygon) return null
  const lat = event.centroidLat ?? event.lat
  const lng = event.centroidLng ?? event.lng

  return {
    id: event.id,
    geometry: event.polygon,
    layer: event.layer,
    severity: event.severity,
    properties: {
      id: event.id,
      layer: event.layer,
      severity: event.severity,
      title: event.title,
    },
    marker: {
      id: event.id,
      lng: lng ?? 0,
      lat: lat ?? 0,
      country: event.country ?? null,
      label: event.label,
      layer: event.layer,
      dataSources: event.dataSources,
      severity: event.severity,
      title: event.title,
      detail: event.detail,
      source: event.source,
      confidence: event.confidence,
      action: event.links?.official ? 'Open official source page' : 'View zone on map',
      live: true,
      isZone: true,
      officialUrl: event.links?.official,
      nwsUrl: event.layer === 'weather' ? event.links?.official : undefined,
      femaUrl: event.layer === 'flood' ? event.links?.official : undefined,
      timestamp: event.timestamp,
      raw: event.raw,
    },
  }
}

/**
 * @param {RiskEvent[]} events
 */
export function riskEventsToPoints(events) {
  return events
    .filter(e => e.geometryType === 'point')
    .map(toRiskPoint)
    .filter(Boolean)
}

/**
 * @param {RiskEvent[]} events
 */
export function riskEventsToZones(events) {
  return events
    .filter(e => e.geometryType === 'polygon')
    .map(toRiskZone)
    .filter(Boolean)
}
