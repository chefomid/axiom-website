import { distanceMiles } from './geo'

/** Feeds already scoped at fetch time — do not filter again by country/radius. */
function isPreScopedLiveMarker(marker) {
  return marker.live && (marker.layer === 'earthquake' || marker.layer === 'environment')
}

export function filterMarkersByScope(markers, { scope, userLocation, radiusMiles, countryId }) {
  return markers.filter(marker => {
    if (isPreScopedLiveMarker(marker)) return true

    if (scope === 'global') return true
    if (scope === 'national') return marker.country === countryId
    if (scope === 'local') {
      if (!userLocation) return false
      return distanceMiles(userLocation, marker) <= radiusMiles
    }
    return true
  })
}

export function filterMarkers(markers, { activeLayers, activeDataSources, scope, userLocation, radiusMiles, countryId }) {
  return markers.filter(marker => {
    if (!activeLayers.has(marker.layer)) return false
    if (!marker.dataSources.some(source => activeDataSources.has(source))) return false

    if (isPreScopedLiveMarker(marker)) return true

    if (scope === 'global') return true
    if (scope === 'national') return marker.country === countryId
    if (scope === 'local') {
      if (!userLocation) return false
      return distanceMiles(userLocation, marker) <= radiusMiles
    }
    return true
  })
}

export function filterSignals(signals, visibleMarkerIds, activeDataSources) {
  const idSet = new Set(visibleMarkerIds)
  return signals.filter(signal => {
    if (!idSet.has(signal.markerId)) return false
    if (!signal.dataSources.some(source => activeDataSources.has(source))) return false
    return true
  })
}

export function filterZones(zones, { activeLayers, activeDataSources, scope, countryId }) {
  return zones.filter(zone => {
    if (!activeLayers.has(zone.layer)) return false
    if (!zone.dataSources.some(source => activeDataSources.has(source))) return false
    if (scope === 'national' && zone.country && zone.country !== countryId) return false
    if (scope === 'global') return true
    return true
  })
}
