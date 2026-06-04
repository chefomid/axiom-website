import { formatFeedError } from './feedErrors'

export const TELEMETRY_SOURCE = {
  earthquake: 'Earthquakes',
  weather: 'Weather',
  wildfire: 'Wildfires',
  flood: 'Floods',
  map: 'Map',
  layers: 'Layers',
  scope: 'View',
  system: 'Map',
}

const FEED_LOADING_LABELS = {
  earthquake: 'earthquake data',
  weather: 'weather alerts',
  wildfire: 'wildfire data',
  flood: 'flood zone data',
}

/** @deprecated Use feedSyncMessage — kept for callers that gate on cache-only loads. */
export function shouldAnnounceFeedLoad(fromCache) {
  return !fromCache
}

export function feedPollingMessage(layer) {
  const label = FEED_LOADING_LABELS[layer] ?? 'hazard data'
  return `Loading ${label}…`
}

export function feedLoadedMessage(layer, count, options = {}) {
  const { minMagnitude } = options

  switch (layer) {
    case 'wildfire':
      return count === 0
        ? 'No active wildfires in this area'
        : `${count} active wildfire${count === 1 ? '' : 's'} in this area`
    case 'earthquake':
      if (count === 0) {
        return minMagnitude != null
          ? `No earthquakes M${minMagnitude}+ in the last 30 days`
          : 'No recent earthquakes in this area'
      }
      return minMagnitude != null
        ? `${count} earthquake${count === 1 ? '' : 's'} M${minMagnitude}+ in the last 30 days`
        : `${count} earthquake${count === 1 ? '' : 's'} in this area`
    case 'weather':
      return count === 0
        ? 'No active weather alerts in this area'
        : `${count} weather alert${count === 1 ? '' : 's'} in this area`
    case 'flood':
      return count === 0
        ? 'No flood zones in this area'
        : `${count} flood zone${count === 1 ? '' : 's'} in this area`
    default:
      return count === 0 ? 'No updates in this area' : `${count} update${count === 1 ? '' : 's'} loaded`
  }
}

export function feedSyncMessage(layer, count, options = {}) {
  const { fromCache = false, minMagnitude } = options
  const summary = feedLoadedMessage(layer, count, { minMagnitude })
  return fromCache ? summary : `${summary} · updated`
}

export function commandPulseMessage({ scope, radiusMiles, countryLabel, signalCount, feedCount, loadingCount }) {
  if (loadingCount > 0) {
    return `Refreshing ${loadingCount} data source${loadingCount === 1 ? '' : 's'}…`
  }
  if (feedCount === 0) {
    return 'No data sources enabled'
  }
  const scopeLabel =
    scope === 'local'
      ? `within ${radiusMiles} mi`
      : scope === 'national' && countryLabel
        ? countryLabel
        : 'worldwide'
  return `${signalCount} active alert${signalCount === 1 ? '' : 's'} · ${feedCount} source${feedCount === 1 ? '' : 's'} · ${scopeLabel}`
}

export function feedFailedMessage(source, message, options = {}) {
  return formatFeedError(source, message, options).title
}

export function telemetrySourceForLayer(layer) {
  return TELEMETRY_SOURCE[layer] ?? 'Map'
}

export function telemetrySourceForFeed(source) {
  const map = {
    USGS: TELEMETRY_SOURCE.earthquake,
    NWS: TELEMETRY_SOURCE.weather,
    'NASA FIRMS': TELEMETRY_SOURCE.wildfire,
    'FEMA NFHL': TELEMETRY_SOURCE.flood,
    NASA: TELEMETRY_SOURCE.wildfire,
    FEMA: TELEMETRY_SOURCE.flood,
  }
  return map[source] ?? source
}

export function dataSourceToggleMessage(label, enabling) {
  const friendly = {
    USGS: 'Earthquake data',
    NWS: 'Weather alerts',
    FEMA: 'Flood zone data',
    NASA: 'Wildfire data',
  }[label] ?? label
  return enabling ? `${friendly} turned on` : `${friendly} turned off`
}

export function layerToggleMessage(label, enabling) {
  return enabling ? `${label} layer turned on` : `${label} layer turned off`
}

export function scopeAppliedMessage(scope, { radiusMiles, countryLabel } = {}) {
  if (scope === 'local') return `Showing data within ${radiusMiles} miles`
  if (scope === 'national' && countryLabel) return `Showing ${countryLabel}`
  if (scope === 'global') return 'Showing worldwide data'
  return 'View updated'
}
