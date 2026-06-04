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

const MAP_STYLE_FALLBACK = 'https://demotiles.maplibre.org/style.json'

const TARGET_ZOOM = 15
const MIN_MOVE_DEG = 0.00008

const MAP_MODES = [
  { id: 'map', label: 'Map' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'street', label: 'Street' },
]

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
  return Math.min(3200, Math.max(1800, 1400 + kmApprox * 420))
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
  loadingReport = false,
  onMapReady,
}) {
  const pin = useMemo(() => {
    const la = parseCoord(lat)
    const ln = parseCoord(lng)
    if (la == null || ln == null) return null
    return { lat: la, lng: ln }
  }, [lat, lng])

  const hasPin = locationLocked && pin != null

  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const attributionRef = useRef(null)
  const lastTargetRef = useRef(null)
  const flyTimerRef = useRef(null)
  const streetFrameRef = useRef(null)

  const [mapReady, setMapReady] = useState(false)
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
    if (markerEl) replayPropertyTargetLockAnimation(markerEl)

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

      if (distance < MIN_MOVE_DEG) {
        liveMap.easeTo({
          ...flyOpts,
          duration: 1200,
          easing: t => t * (2 - t),
        })
        return
      }

      if (typeof liveMap.stop === 'function') liveMap.stop()

      liveMap.flyTo({
        ...flyOpts,
        duration: flyDurationMs(distance),
        speed: 0.55,
        curve: 1.2,
      })
    }

    flyTimerRef.current = setTimeout(applyTarget, flyDelay)

    return () => {
      if (flyTimerRef.current) {
        clearTimeout(flyTimerRef.current)
        flyTimerRef.current = null
      }
    }
  }, [mapReady, pin, label, flyDelay])

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

      {hasPin ? (
        <div
          className="property-map-mode-bar absolute left-3 top-3 z-20 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Map view mode"
        >
          <div className="flex rounded border border-panel-border/80 bg-black/75 p-0.5 shadow-lg backdrop-blur-sm">
            {MAP_MODES.map(mode => {
              const streetReady =
                mode.id === 'street' && streetAvailable === true && !checkingStreet
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setMapMode(mode.id)}
                  className={`relative rounded px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider transition ${
                    mapMode === mode.id
                      ? 'bg-command-live/15 text-command-live'
                      : 'text-ink-faint hover:text-ink-secondary'
                  }`}
                >
                  {mode.label}
                  {streetReady && mapMode !== 'street' ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-command-stable ring-1 ring-black"
                      title="Street View available"
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {showStreetOverlay ? (
        <div className="absolute inset-0 z-[15] flex flex-col bg-black">
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

      {loadingReport ? (
        <div className="pointer-events-none absolute inset-0 z-[18] flex items-center justify-center bg-black/50 font-mono text-[10px] text-ink-muted">
          Generating report…
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

      {showPlaceholder ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#050505] px-6">
          <div className="w-full max-w-md rounded-sm border border-command-watch/60 bg-panel-surface/40 px-6 py-5 shadow-[0_0_0_1px_rgba(232,168,56,0.16),0_10px_40px_rgba(0,0,0,0.72)]">
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-command-watch">
              LOCATION REQUIRED
            </p>
            <div className="my-3 h-px w-full bg-command-watch/30" />
            <p className="text-center font-mono text-[12px] leading-relaxed text-ink-secondary">
              Enter an address to locate the property. Use <span className="text-ink-primary">Satellite</span> or{' '}
              <span className="text-ink-primary">Street</span>.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
