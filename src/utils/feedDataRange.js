/** Keep in sync with services/usgsEarthquakes.js LOOKBACK_DAYS */
export const USGS_LOOKBACK_DAYS = 30

/** Keep in sync with services/nasaFirms.js DAY_RANGE (days of VIIRS detections) */
export const FIRMS_DAY_RANGE = 1

/**
 * Human-readable coverage window for each Public Data Command feed.
 * @param {string} sourceName
 * @param {{ minMagnitude?: number }} [options]
 */
export function getFeedDataRangeLabel(sourceName, options = {}) {
  const { minMagnitude } = options

  switch (sourceName) {
    case 'USGS': {
      const window = `last ${USGS_LOOKBACK_DAYS}d`
      if (minMagnitude != null) return `${window} · M${minMagnitude}+`
      return window
    }
    case 'NWS':
      return 'active alerts'
    case 'NASA FIRMS':
      return FIRMS_DAY_RANGE === 1 ? 'last 24h' : `last ${FIRMS_DAY_RANGE}d`
    case 'NASA EONET':
      return 'open events'
    case 'NIFC WFIGS':
      return 'current incidents'
    case 'NIFC + NASA':
    case 'Wildfire':
      return 'current · last 24h'
    case 'FEMA NFHL':
      return options.overlay ? 'zoom in for zones' : 'reference map'
    default:
      return null
  }
}
