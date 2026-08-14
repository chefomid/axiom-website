export const WILDFIRE_KIND_OPTIONS = [
  { id: 'hotspot', label: 'Hotspot' },
  { id: 'named', label: 'Named Fires' },
  { id: 'both', label: 'Both' },
]

export function mergeWildfireEvents(namedEvents = [], hotspotEvents = []) {
  const named = dedupeByIdAndCoord(namedEvents)
  const namedIds = new Set(named.map(e => e.id))
  const hotspots = []
  const hotspotIds = new Set()
  for (const event of hotspotEvents) {
    if (!event?.id || namedIds.has(event.id) || hotspotIds.has(event.id)) continue
    hotspotIds.add(event.id)
    hotspots.push(event)
  }
  return [...named, ...hotspots]
}

function dedupeByIdAndCoord(events) {
  const seen = new Set()
  const out = []
  for (const event of events) {
    if (!event) continue
    const coordKey = `${Number(event.lat).toFixed(3)}|${Number(event.lng).toFixed(3)}`
    if (seen.has(event.id) || seen.has(coordKey)) continue
    seen.add(event.id)
    seen.add(coordKey)
    out.push(event)
  }
  return out
}

export function wildfireKindFromMarker(marker) {
  const id = String(marker?.id ?? '')
  if (id.startsWith('firms-')) return 'hotspot'
  if (id.startsWith('nifc-') || id.startsWith('eonet-')) return 'named'
  if (marker?.layer === 'wildfire' && marker?.source === 'NIFC') return 'named'
  if (marker?.layer === 'wildfire') return 'hotspot'
  return null
}

export function filterMarkersByWildfireKind(markers, kind = 'both') {
  if (kind === 'both') return markers
  return markers.filter(marker => {
    if (marker.layer !== 'wildfire') return true
    return wildfireKindFromMarker(marker) === kind
  })
}

function acresFromMarker(marker) {
  const raw = marker?.raw ?? {}
  const size = Number(raw.IncidentSize)
  if (Number.isFinite(size) && size > 0) return size

  const geometries = Array.isArray(raw.geometry) ? raw.geometry : []
  for (let i = geometries.length - 1; i >= 0; i -= 1) {
    const g = geometries[i]
    if (g?.magnitudeUnit === 'acres' && Number.isFinite(Number(g.magnitudeValue))) {
      return Number(g.magnitudeValue)
    }
  }
  return null
}

function scaleFromAcres(acres) {
  if (!Number.isFinite(acres) || acres <= 0) return 0.75
  if (acres < 10) return 0.55
  if (acres < 100) return 0.72
  if (acres < 1000) return 0.95
  if (acres < 10000) return 1.2
  return 1.45
}

function scaleFromHotspot(raw) {
  const frp = Number(raw?.frp)
  if (Number.isFinite(frp) && frp > 0) {
    if (frp < 5) return 0.55
    if (frp < 15) return 0.62
    if (frp < 40) return 0.7
    if (frp < 80) return 0.78
    return 0.88
  }
  const brightness = Number(raw?.bright_ti4 ?? raw?.brightness)
  if (Number.isFinite(brightness)) {
    if (brightness < 330) return 0.55
    if (brightness < 350) return 0.62
    if (brightness < 400) return 0.7
    return 0.8
  }
  return 0.6
}

export function wildfireFlameScale(marker) {
  if (wildfireKindFromMarker(marker) === 'named') return scaleFromAcres(acresFromMarker(marker))
  return scaleFromHotspot(marker?.raw)
}

export function containedPercent(marker) {
  const raw = Number(marker?.raw?.PercentContained)
  if (Number.isFinite(raw)) return Math.min(100, Math.max(0, raw))

  const match = String(marker?.detail ?? '').match(/(\d+(?:\.\d+)?)\s*%\s*contained/i)
  if (!match) return null
  const fromDetail = Number(match[1])
  if (!Number.isFinite(fromDetail)) return null
  return Math.min(100, Math.max(0, fromDetail))
}
