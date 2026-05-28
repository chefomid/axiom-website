import { markerInScope } from './scopeBbox'

export function filterMarkersByScope(markers, scopeConfig) {
  return markers.filter(marker => markerInScope(marker, scopeConfig))
}

export function filterMarkers(markers, { activeLayers, activeDataSources, ...scopeConfig }) {
  return markers.filter(marker => {
    if (!activeLayers.has(marker.layer)) return false
    if (!marker.dataSources.some(source => activeDataSources.has(source))) return false
    return markerInScope(marker, scopeConfig)
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
  const scopeConfig = { scope, countryId }
  return zones.filter(zone => {
    if (!activeLayers.has(zone.layer)) return false
    if (!zone.dataSources.some(source => activeDataSources.has(source))) return false
    if (scope === 'global') return true

    const lat = zone.lat ?? zone.marker?.lat
    const lng = zone.lng ?? zone.marker?.lng
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return markerInScope({ lat, lng, country: zone.country ?? zone.marker?.country }, scopeConfig)
    }

    if (scope === 'national' && zone.country) return zone.country === countryId
    return scope !== 'national'
  })
}
