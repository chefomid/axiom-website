/** @typedef {'point' | 'polygon'} GeometryType */

/**
 * @typedef {Object} RiskEvent
 * @property {string} id
 * @property {string} source
 * @property {string} layer
 * @property {GeometryType} geometryType
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {import('geojson').Polygon | import('geojson').MultiPolygon} [polygon]
 * @property {number} [centroidLat]
 * @property {number} [centroidLng]
 * @property {string} title
 * @property {'stable' | 'live' | 'watch' | 'critical'} severity
 * @property {string} [timestamp]
 * @property {number} confidence
 * @property {string} detail
 * @property {string} label
 * @property {string[]} dataSources
 * @property {string} [country]
 * @property {Record<string, unknown>} [raw]
 * @property {{ official?: string }} [links]
 */

export const RISK_SOURCES = {
  USGS: 'USGS',
  NWS: 'NWS',
  NASA: 'NASA',
  FEMA: 'FEMA',
  EPA: 'EPA',
}
