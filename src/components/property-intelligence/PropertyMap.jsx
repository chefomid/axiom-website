import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from '../../lib/maplibre'
import { parseCoord } from '../../utils/coords'
import {
  COMMAND_MAP_STYLE,
  ensureAnalysisSatelliteImagery,
  setAnalysisSatelliteImagery,
} from '../../utils/mapBasemaps'
import {
  createPropertyMapPinElement,
  replayPropertyTargetLockAnimation,
  setPropertyMapPinPending,
} from '../../utils/propertyMapPin'
import {
  googleMapsApiKey,
  googleMapsStreetViewUrl,
  googleStreetViewAvailable,
  googleStreetViewEmbedUrl,
  mapillaryAppUrl,
  clampPitch,
  stepHeading,
  STREET_HEADING_STEP,
  STREET_PITCH_STEP,
} from '../../services/propertyImagery'
import StreetViewControls from './StreetViewControls'
import ScheduleMapLayer from './ScheduleMapLayer'

const MAP_STYLE_FALLBACK = 'https://demotiles.maplibre.org/style.json'

const TARGET_ZOOM = 15
const DOSSIER_ZOOM = 17
const MIN_MOVE_DEG = 0.00008

const MAP_MODES = [
  { id: 'map', label: 'Map' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'street', label: 'Street' },
]

function MapModeBar({ mapMode, setMapMode, streetAvailable, checkingStreet, compact = false }) {
  return (
    <div
      className={`flex rounded border border-panel-border/80 bg-black/90 p-0.5 shadow-lg backdrop-blur-sm ${
        compact ? '' : 'shadow-lg'
      }`}
      role="group"
      aria-label="Map view mode"
    >
      {MAP_MODES.map(mode => {
        const streetReady = mode.id === 'street' && streetAvailable === true && !checkingStreet
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => setMapMode(mode.id)}
            className={`relative rounded px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider transition ${
              mapMode === mode.id
                ? 'bg-command-live/15 text-command-live'
                : 'text-ink-secondary hover:text-white'
            }`}
          >
            {mode.label}
            {streetReady && mapMode !== 'street' ? (
              <span
                className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-command-watch ring-1 ring-black"
                title="Street View available"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function coordKey(lat, lng) {
  return `${lat.toFixed(5)}|${lng.toFixed(5)}`
}

function moveDistanceDeg(aLat, aLng, bLat, bLng) {
  const dLat = aLat - bLat
  const dLng = aLng - bLng
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

function flyDurationMs(distanceDeg) {
  const kmApprox = distanceDeg * 111
  return Math.min(2200, Math.max(1600, 1200 + kmApprox * 380))
}

function markerElement(marker) {
  if (!marker) return null
  if (typeof marker.getElement === 'function') return marker.getElement()
  return marker._element ?? null
}

export default function PropertyMap({
  lat,
  lng,
  label,
  flyDelay = 900,
  showPlaceholder = false,
  locationLocked = false,
  locationPhase = 'idle',
  onMapReady,
  scheduleLocations = null,
  scheduleFocusRowIndex = null,
  scheduleFitAllSignal = 0,
  scheduleValidCount = 0,
  scheduleInvalidCount = 0,
  onScheduleLocationSelect,
  onScheduleFitAll,
  preferredMode = null,
  /** When this value changes, force recenter + zoom on the pin (e.g. dossier open). */
  focusSignal = 0,
}) {
  const pin = useMemo(() => {
    const la = parseCoord(lat)
    const ln = parseCoord(lng)
    if (la == null || ln == null) return null
    return { lat: la, lng: ln }
  }, [lat, lng])

  const pinPending = locationPhase === 'composing' || locationPhase === 'searching'
  const showLocatingOverlay = locationPhase === 'resolving' || locationPhase === 'locating'
  const scheduleModeActive = Boolean(scheduleLocations?.length)
  const hasPin =
    !scheduleModeActive &&
    pin != null &&
    (locationLocked || pinPending || locationPhase === 'resolving' || locationPhase === 'locating')

  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const attributionRef = useRef(null)
  const lastTargetRef = useRef(null)
  const flyTimerRef = useRef(null)
  const moveEndHandlerRef = useRef(null)
  const streetFrameRef = useRef(null)
  const flyDelayRef = useRef(flyDelay)
  const locationLockedRef = useRef(locationLocked)
  const pinPendingRef = useRef(pinPending)

  flyDelayRef.current = flyDelay
  locationLockedRef.current = locationLocked
  pinPendingRef.current = pinPending

  const [mapReady, setMapReady] = useState(false)
  const [mapInstance, setMapInstance] = useState(null)
  const [mapInitError, setMapInitError] = useState(null)
  const [mapMode, setMapMode] = useState('map')

  const [heading, setHeading] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [fov, setFov] = useState(85)
  const [streetAvailable, setStreetAvailable] = useState(null)
  const [checkingStreet, setCheckingStreet] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const googleKey = googleMapsApiKey()

  useEffect(() => {
    if (!hasPin) {
      setMapMode('map')
      setStreetAvailable(null)
      setCheckingStreet(false)
    }
  }, [hasPin])

  useEffect(() => {
    setHeading(0)
    setPitch(0)
    setFov(85)
  }, [lat, lng])

  useEffect(() => {
    if (!hasPin || !googleKey) {
      setStreetAvailable(null)
      setCheckingStreet(false)
      return undefined
    }
    let cancelled = false
    setCheckingStreet(true)
    setStreetAvailable(null)
    googleStreetViewAvailable(pin.lat, pin.lng, googleKey).then(ok => {
      if (!cancelled) {
        setStreetAvailable(ok)
        setCheckingStreet(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [hasPin, pin?.lat, pin?.lng, googleKey])

  useEffect(() => {
    if (!preferredMode || !hasPin) return
    if (preferredMode === 'street') {
      if (streetAvailable === true) setMapMode('street')
      else if (streetAvailable === false) setMapMode('map')
      return
    }
    setMapMode(preferredMode)
  }, [preferredMode, hasPin, streetAvailable])

  const streetEmbed =
    hasPin && googleKey && streetAvailable === true
      ? googleStreetViewEmbedUrl(pin.lat, pin.lng, googleKey, { heading, pitch, fov })
      : null

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map?.isStyleLoaded?.()) return

    const satelliteOn = mapMode === 'satellite'
    ensureAnalysisSatelliteImagery(map)
    void setAnalysisSatelliteImagery(map, satelliteOn, { animate: false })

    if (satelliteOn && !attributionRef.current) {
      attributionRef.current = new maplibregl.AttributionControl({ compact: true })
      map.addControl(attributionRef.current, 'bottom-left')
    } else if (!satelliteOn && attributionRef.current) {
      try {
        map.removeControl(attributionRef.current)
      } catch {
        /* already removed */
      }
      attributionRef.current = null
    }
  }, [mapMode, mapReady])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return

    setMapInitError(null)
    let map = null
    let styleFallbackUsed = false

    const init = () => {
      map = new maplibregl.Map({
        container,
        style: COMMAND_MAP_STYLE,
        center: [-98.5, 39.8],
        zoom: 3,
        attributionControl: false,
      })
      mapRef.current = map

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

      map.on('error', e => {
        if (!styleFallbackUsed && e?.error?.message?.includes('style')) {
          styleFallbackUsed = true
          map.setStyle(MAP_STYLE_FALLBACK)
        }
      })

      map.on('load', () => {
        ensureAnalysisSatelliteImagery(map)
        void setAnalysisSatelliteImagery(map, false, { animate: false })
        setMapReady(true)
        setMapInstance(map)
        map.resize()
        onMapReady?.(map)
      })
    }

    init()

    const ro = new ResizeObserver(() => map?.resize())
    ro.observe(container)

    return () => {
      ro.disconnect()
      if (attributionRef.current && map) {
        try {
          map.removeControl(attributionRef.current)
        } catch {
          /* */
        }
        attributionRef.current = null
      }
      markerRef.current?.remove()
      markerRef.current = null
      map?.remove()
      mapRef.current = null
      setMapReady(false)
      setMapInstance(null)
      onMapReady?.(null)
    }
  }, [onMapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return undefined

    if (!pin) {
      markerRef.current?.remove()
      markerRef.current = null
      lastTargetRef.current = null
      return undefined
    }

    const { lat: pinLat, lng: pinLng } = pin

    try {
      if (!markerRef.current) {
        const pinEl = createPropertyMapPinElement()
        if (label) pinEl.title = label
        markerRef.current = new maplibregl.Marker({ element: pinEl, anchor: 'center' })
          .setLngLat([pinLng, pinLat])
          .addTo(map)
      } else {
        markerRef.current.setLngLat([pinLng, pinLat])
        const el = markerElement(markerRef.current)
        if (label && el) el.title = label
      }
    } catch (err) {
      console.warn('PropertyMap: marker update failed', err)
      return undefined
    }

    const key = coordKey(pinLat, pinLng)
    const isNewTarget = lastTargetRef.current !== key
    if (!isNewTarget) return undefined

    const markerEl = markerElement(markerRef.current)
    if (markerEl) {
      setPropertyMapPinPending(
        markerEl,
        pinPendingRef.current && !locationLockedRef.current,
      )
      if (locationLockedRef.current) replayPropertyTargetLockAnimation(markerEl)
    }

    if (flyTimerRef.current) {
      clearTimeout(flyTimerRef.current)
      flyTimerRef.current = null
    }

    const applyTarget = () => {
      const liveMap = mapRef.current
      if (!liveMap || !pin) return
      if (typeof liveMap.isStyleLoaded === 'function' && !liveMap.isStyleLoaded()) {
        liveMap.once('idle', applyTarget)
        return
      }

      const { lat: pinLat, lng: pinLng } = pin
      lastTargetRef.current = key
      markerRef.current?.setLngLat([pinLng, pinLat])

      const flyOpts = {
        center: [pinLng, pinLat],
        zoom: Math.max(liveMap.getZoom(), TARGET_ZOOM),
        essential: true,
      }

      let distance = 1
      try {
        const center = liveMap.getCenter()
        const centerLat = parseCoord(center?.lat)
        const centerLng = parseCoord(center?.lng)
        if (centerLat != null && centerLng != null) {
          distance = moveDistanceDeg(centerLat, centerLng, pinLat, pinLng)
        }
      } catch {
        /* map center unavailable during style swap */
      }

      if (typeof liveMap.stop === 'function') liveMap.stop()

      const onMoveEnd = () => {
        const el = markerElement(markerRef.current)
        if (el && !el.classList.contains('property-target-marker--pending')) {
          replayPropertyTargetLockAnimation(el)
        }
        if (moveEndHandlerRef.current) {
          liveMap.off('moveend', moveEndHandlerRef.current)
          moveEndHandlerRef.current = null
        }
      }

      if (moveEndHandlerRef.current) {
        liveMap.off('moveend', moveEndHandlerRef.current)
      }
      moveEndHandlerRef.current = onMoveEnd
      liveMap.on('moveend', onMoveEnd)

      const delay = flyDelayRef.current

      if (distance < MIN_MOVE_DEG) {
        liveMap.easeTo({
          ...flyOpts,
          duration: delay === 0 ? 650 : 1000,
          easing: t => t * (2 - t),
        })
        return
      }

      const duration = delay === 0
        ? Math.min(900, Math.max(500, flyDurationMs(distance) * 0.45))
        : flyDurationMs(distance)

      liveMap.flyTo({
        ...flyOpts,
        duration,
        speed: delay === 0 ? 1.1 : 0.55,
        curve: delay === 0 ? 1.05 : 1.2,
      })
    }

    flyTimerRef.current = setTimeout(applyTarget, flyDelayRef.current)

    return () => {
      if (flyTimerRef.current) {
        clearTimeout(flyTimerRef.current)
        flyTimerRef.current = null
      }
      const liveMap = mapRef.current
      if (liveMap && moveEndHandlerRef.current) {
        liveMap.off('moveend', moveEndHandlerRef.current)
        moveEndHandlerRef.current = null
      }
    }
  }, [mapReady, pin?.lat, pin?.lng])

  useEffect(() => {
    if (!focusSignal || !mapReady || !pin) return undefined
    const liveMap = mapRef.current
    if (!liveMap) return undefined

    const run = () => {
      const map = mapRef.current
      if (!map) return
      try {
        map.resize()
      } catch {
        /* */
      }
      if (typeof map.stop === 'function') map.stop()
      // Jump first so a continent-scale view never lingers after report open.
      map.jumpTo({
        center: [pin.lng, pin.lat],
        zoom: DOSSIER_ZOOM,
      })
      lastTargetRef.current = coordKey(pin.lat, pin.lng)
      markerRef.current?.setLngLat([pin.lng, pin.lat])
    }

    if (typeof liveMap.isStyleLoaded === 'function' && !liveMap.isStyleLoaded()) {
      liveMap.once('idle', run)
      return () => {
        liveMap.off('idle', run)
      }
    }

    const t = window.setTimeout(run, 40)
    return () => window.clearTimeout(t)
  }, [focusSignal, mapReady, pin?.lat, pin?.lng])

  useEffect(() => {
    const el = markerElement(markerRef.current)
    if (el && label) el.title = label
  }, [label])

  useEffect(() => {
    const el = markerElement(markerRef.current)
    if (el) setPropertyMapPinPending(el, pinPending && !locationLocked)
  }, [pinPending, locationLocked, hasPin])

  const toggleFullscreen = useCallback(() => {
    const el = streetFrameRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === streetFrameRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (mapMode !== 'street' || !streetEmbed) return undefined
    const onKey = e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setHeading(h => stepHeading(h, -STREET_HEADING_STEP))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setHeading(h => stepHeading(h, STREET_HEADING_STEP))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPitch(p => clampPitch(p + STREET_PITCH_STEP))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPitch(p => clampPitch(p - STREET_PITCH_STEP))
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mapMode, streetEmbed, toggleFullscreen])

  const showStreetOverlay = mapMode === 'street' && hasPin

  return (
    <div className="command-map-host property-map-host relative h-full min-h-[280px] w-full bg-[#050505]">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {(hasPin || scheduleModeActive) && mapMode !== 'street' ? (
        <div
          className="property-map-mode-bar absolute left-3 top-3 z-20 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Map view mode"
        >
          <MapModeBar
            mapMode={mapMode}
            setMapMode={setMapMode}
            streetAvailable={scheduleModeActive ? false : streetAvailable}
            checkingStreet={scheduleModeActive ? false : checkingStreet}
          />
        </div>
      ) : null}

      {scheduleModeActive && mapMode !== 'street' ? (
        <ScheduleMapLayer
          map={mapInstance}
          mapReady={mapReady}
          locations={scheduleLocations}
          focusRowIndex={scheduleFocusRowIndex}
          fitAllSignal={scheduleFitAllSignal}
          validCount={scheduleValidCount}
          invalidCount={scheduleInvalidCount}
          onLocationSelect={onScheduleLocationSelect}
          onFitAll={onScheduleFitAll}
        />
      ) : null}

      {showStreetOverlay ? (
        <div className="absolute inset-0 z-[15] flex flex-col bg-black">
          {!isFullscreen ? (
            <div className="street-view-top-bar flex shrink-0 items-center justify-between gap-3 border-b border-panel-border bg-black px-3 py-2">
              <MapModeBar
                mapMode={mapMode}
                setMapMode={setMapMode}
                streetAvailable={streetAvailable}
                checkingStreet={checkingStreet}
                compact
              />
              {label ? (
                <p className="min-w-0 truncate font-mono text-[9px] text-ink-secondary" title={label}>
                  {label}
                </p>
              ) : null}
            </div>
          ) : null}
          <div
            ref={streetFrameRef}
            className={`street-view-frame relative min-h-0 flex-1 ${isFullscreen ? 'street-view-frame--fullscreen' : ''}`}
          >
            {checkingStreet ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <span className="street-view-spinner" aria-hidden />
                <p className="font-mono text-[10px] text-ink-muted">Checking Street View coverage…</p>
              </div>
            ) : streetEmbed ? (
              <>
                <iframe
                  key={`${pin.lat}-${pin.lng}-${heading}-${pitch}-${fov}`}
                  title="Street view"
                  src={streetEmbed}
                  className="h-full w-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <StreetViewControls
                  heading={heading}
                  pitch={pitch}
                  onHeadingChange={setHeading}
                  onPitchChange={setPitch}
                  onFovChange={setFov}
                  onFullscreen={toggleFullscreen}
                  isFullscreen={isFullscreen}
                  mapsUrl={googleMapsStreetViewUrl(pin.lat, pin.lng)}
                />
                {isFullscreen ? (
                  <div className="pointer-events-auto absolute left-3 top-3 z-20">
                    <MapModeBar
                      mapMode={mapMode}
                      setMapMode={setMapMode}
                      streetAvailable={streetAvailable}
                      checkingStreet={checkingStreet}
                      compact
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="rounded-md border border-panel-border bg-panel-surface/50 px-4 py-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Street View</p>
                  <p className="mt-2 max-w-xs font-mono text-[10px] leading-relaxed text-ink-secondary">
                    {!googleKey
                      ? 'Add VITE_GOOGLE_MAPS_API_KEY for embedded panoramas.'
                      : streetAvailable === false
                        ? 'No Google coverage at this pin.'
                        : 'Street View could not be loaded.'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <a
                    href={googleMapsStreetViewUrl(pin.lat, pin.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-command-live/40 bg-command-live/10 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-command-live transition hover:bg-command-live/20"
                  >
                    Open Google Maps
                  </a>
                  <a
                    href={mapillaryAppUrl(pin.lat, pin.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-panel-border bg-panel-surface/40 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-ink-secondary transition hover:border-command-live/30 hover:text-white"
                  >
                    Mapillary
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {mapInitError ? (
        <p className="absolute inset-x-0 top-4 z-10 px-4 text-center font-mono text-xs text-command-critical">
          {mapInitError}
        </p>
      ) : null}

      {!mapReady && lat != null ? (
        <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-mono text-[10px] text-ink-faint">
          Loading map…
        </p>
      ) : null}

      <div
        className={`pi-map-locating-overlay ${showLocatingOverlay ? 'pi-map-locating-overlay--active' : ''}`}
        aria-hidden
      />

      {showPlaceholder ? (
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[#050505]" aria-hidden />
      ) : null}
    </div>
  )
}
