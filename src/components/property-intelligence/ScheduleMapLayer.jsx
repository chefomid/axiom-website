import { useCallback, useEffect, useRef } from 'react'
import maplibregl from '../../lib/maplibre'
import { parseCoord } from '../../utils/coords'
import {
  createScheduleMapPinElement,
  setScheduleMapPinHighlighted,
} from '../../utils/propertyMapPin'

const FIT_PADDING = { top: 72, bottom: 88, left: 56, right: 56 }
const FOCUS_ZOOM = 15.5
const SINGLE_ZOOM = 14.5
const FIT_MAX_ZOOM = 13.5

function boundsFromLocations(locations) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let count = 0

  for (const loc of locations) {
    const lat = parseCoord(loc.lat)
    const lng = parseCoord(loc.lng)
    if (lat == null || lng == null) continue
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
    count += 1
  }

  if (!count) return null

  if (count === 1) {
    return { type: 'point', lat: minLat, lng: minLng }
  }

  return {
    type: 'bounds',
    bounds: [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
  }
}

function flyDurationMs(distanceDeg) {
  const kmApprox = distanceDeg * 111
  return Math.min(2200, Math.max(1200, 900 + kmApprox * 320))
}

export default function ScheduleMapLayer({
  map,
  mapReady,
  locations = [],
  focusRowIndex = null,
  fitAllSignal = 0,
  onLocationSelect,
  onFitAll,
  validCount = 0,
  invalidCount = 0,
}) {
  const markersRef = useRef(new Map())
  const lastFitSignalRef = useRef(0)
  const lastFocusRef = useRef(null)

  const clearMarkers = useCallback(() => {
    for (const marker of markersRef.current.values()) {
      marker.remove()
    }
    markersRef.current.clear()
  }, [])

  const syncMarkers = useCallback(() => {
    const liveMap = map
    if (!liveMap) return

    const nextIds = new Set()
    for (const loc of locations) {
      const lat = parseCoord(loc.lat)
      const lng = parseCoord(loc.lng)
      if (lat == null || lng == null) continue

      const id = String(loc.row_index)
      nextIds.add(id)
      const highlighted = focusRowIndex != null && loc.row_index === focusRowIndex

      let marker = markersRef.current.get(id)
      if (!marker) {
        const el = createScheduleMapPinElement({
          index: loc.row_index,
          highlighted,
          invalid: loc.status === 'invalid',
        })
        el.title = loc.label ?? loc.address_input ?? ''
        el.addEventListener('click', event => {
          event.stopPropagation()
          onLocationSelect?.(loc)
        })
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(liveMap)
        markersRef.current.set(id, marker)
      } else {
        marker.setLngLat([lng, lat])
        const el = marker.getElement()
        setScheduleMapPinHighlighted(el, highlighted)
        if (loc.status === 'invalid') {
          el.classList.add('schedule-map-pin--invalid')
        }
      }
    }

    for (const [id, marker] of markersRef.current.entries()) {
      if (!nextIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }
  }, [map, locations, focusRowIndex, onLocationSelect])

  const animateToView = useCallback(
    (view, { immediate = false } = {}) => {
      const liveMap = map
      if (!liveMap?.isStyleLoaded?.()) return

      if (typeof liveMap.stop === 'function') liveMap.stop()

      if (view.type === 'point') {
        const duration = immediate ? 0 : 1400
        liveMap.flyTo({
          center: [view.lng, view.lat],
          zoom: Math.max(liveMap.getZoom(), SINGLE_ZOOM),
          duration,
          essential: true,
          speed: 0.65,
          curve: 1.15,
        })
        return
      }

      const duration = immediate ? 0 : 1800
      liveMap.fitBounds(view.bounds, {
        padding: FIT_PADDING,
        duration,
        maxZoom: FIT_MAX_ZOOM,
        essential: true,
      })
    },
    [map],
  )

  const fitAllLocations = useCallback(
    ({ immediate = false } = {}) => {
      const view = boundsFromLocations(locations)
      if (!view) return
      animateToView(view, { immediate })
    },
    [locations, animateToView],
  )

  useEffect(() => {
    if (!mapReady || !map) return undefined
    syncMarkers()
    return () => {
      clearMarkers()
    }
  }, [mapReady, map, syncMarkers, clearMarkers])

  useEffect(() => {
    if (!mapReady || !map || !locations.length) return undefined

    if (fitAllSignal !== lastFitSignalRef.current) {
      lastFitSignalRef.current = fitAllSignal
      lastFocusRef.current = null
      fitAllLocations({ immediate: fitAllSignal < 0 })
      return undefined
    }

    if (focusRowIndex == null) return undefined
    if (lastFocusRef.current === focusRowIndex) return undefined
    lastFocusRef.current = focusRowIndex

    const target = locations.find(loc => loc.row_index === focusRowIndex)
    const lat = parseCoord(target?.lat)
    const lng = parseCoord(target?.lng)
    if (lat == null || lng == null) return undefined

    const liveMap = map
    if (!liveMap?.isStyleLoaded?.()) return undefined

    let distance = 1
    try {
      const center = liveMap.getCenter()
      const centerLat = parseCoord(center?.lat)
      const centerLng = parseCoord(center?.lng)
      if (centerLat != null && centerLng != null) {
        const dLat = lat - centerLat
        const dLng = lng - centerLng
        distance = Math.sqrt(dLat * dLat + dLng * dLng)
      }
    } catch {
      /* */
    }

    if (typeof liveMap.stop === 'function') liveMap.stop()
    liveMap.flyTo({
      center: [lng, lat],
      zoom: Math.max(liveMap.getZoom(), FOCUS_ZOOM),
      duration: flyDurationMs(distance),
      essential: true,
      speed: 0.7,
      curve: 1.1,
    })

    return undefined
  }, [mapReady, map, locations, focusRowIndex, fitAllSignal, fitAllLocations])

  if (!locations.length) return null

  const total = validCount + invalidCount

  return (
    <div className="schedule-map-overlay absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-end justify-between gap-2 sm:right-auto">
      <div className="rounded-lg border border-panel-border/90 bg-black/85 px-3 py-2 shadow-lg backdrop-blur-sm">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">Schedule</p>
        <p className="mt-0.5 font-mono text-[11px] text-white">
          {locations.length} on map
          {total > locations.length ? ` · ${total - locations.length} unplotted` : ''}
        </p>
        {invalidCount > 0 ? (
          <p className="mt-0.5 font-mono text-[9px] text-command-critical">
            {invalidCount} address{invalidCount === 1 ? '' : 'es'} could not be geocoded
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onFitAll?.()}
        className="rounded-lg border border-panel-border/90 bg-black/85 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-command-live shadow-lg backdrop-blur-sm transition hover:border-command-live/50 hover:bg-command-live/10 hover:text-white"
      >
        Fit all locations
      </button>
    </div>
  )
}
