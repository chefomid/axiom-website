import { useEffect, useRef, useState } from 'react'
import {
  clampPitch,
  fovToStreetZoom,
  googleStreetViewEmbedUrl,
  loadGoogleMapsJs,
  normalizeHeading,
} from '../../services/propertyImagery'

const EMBED_PAINT_DELAY_MS = 480

/**
 * Street View viewer without black shutter on look/compass clicks.
 * Prefers Maps JS StreetViewPanorama (setPov in place). Falls back to
 * double-buffered Embed iframes that keep the current frame on top until
 * the next one has painted.
 */
export default function StreetViewEmbedFrame({ lat, lng, apiKey, heading, pitch, fov }) {
  // Start on buffered embed (no blank wait). Upgrade to JS panorama when available.
  const [mode, setMode] = useState('embed') // panorama | embed

  useEffect(() => {
    let cancelled = false
    loadGoogleMapsJs(apiKey)
      .then(() => {
        if (!cancelled) setMode('panorama')
      })
      .catch(() => {
        if (!cancelled) setMode('embed')
      })
    return () => {
      cancelled = true
    }
  }, [apiKey])

  if (mode === 'panorama') {
    return (
      <StreetViewPanoramaFrame
        lat={lat}
        lng={lng}
        apiKey={apiKey}
        heading={heading}
        pitch={pitch}
        fov={fov}
        onUnavailable={() => setMode('embed')}
      />
    )
  }

  return (
    <StreetViewBufferedEmbed lat={lat} lng={lng} apiKey={apiKey} heading={heading} pitch={pitch} fov={fov} />
  )
}

function StreetViewPanoramaFrame({ lat, lng, apiKey, heading, pitch, fov, onUnavailable }) {
  const containerRef = useRef(null)
  const panoramaRef = useRef(null)
  const onUnavailableRef = useRef(onUnavailable)
  onUnavailableRef.current = onUnavailable

  // Create / relocate panorama when the pin changes.
  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return undefined

    loadGoogleMapsJs(apiKey)
      .then(maps => {
        if (cancelled || !containerRef.current) return

        const position = { lat: Number(lat), lng: Number(lng) }
        const pov = {
          heading: normalizeHeading(heading),
          pitch: clampPitch(pitch),
        }
        const zoom = fovToStreetZoom(fov)

        if (panoramaRef.current) {
          panoramaRef.current.setPosition(position)
          panoramaRef.current.setPov(pov)
          panoramaRef.current.setZoom(zoom)
          return
        }

        const panorama = new maps.StreetViewPanorama(containerRef.current, {
          position,
          pov,
          zoom,
          visible: true,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          enableCloseButton: false,
          linksControl: true,
          panControl: false,
          zoomControl: false,
          showRoadLabels: true,
        })

        panorama.addListener('status_changed', () => {
          const status = panorama.getStatus?.()
          // Only bail on hard failures; ignore transient UNKNOWN while tiles settle.
          if (status === 'ZERO_RESULTS' || status === 'UNKNOWN_ERROR') {
            onUnavailableRef.current?.()
          }
        })

        panoramaRef.current = panorama
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current?.()
      })

    return () => {
      cancelled = true
    }
    // heading/pitch/fov applied in separate effects after create
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pin relocate only
  }, [apiKey, lat, lng])

  useEffect(() => {
    const panorama = panoramaRef.current
    if (!panorama) return
    panorama.setPov({
      heading: normalizeHeading(heading),
      pitch: clampPitch(pitch),
    })
  }, [heading, pitch])

  useEffect(() => {
    const panorama = panoramaRef.current
    if (!panorama) return
    panorama.setZoom(fovToStreetZoom(fov))
  }, [fov])

  useEffect(
    () => () => {
      const panorama = panoramaRef.current
      panoramaRef.current = null
      try {
        panorama?.setVisible(false)
      } catch {
        /* ignore */
      }
      if (containerRef.current) containerRef.current.innerHTML = ''
    },
    [],
  )

  return <div ref={containerRef} className="h-full w-full bg-black" />
}

function StreetViewBufferedEmbed({ lat, lng, apiKey, heading, pitch, fov }) {
  const targetUrl = googleStreetViewEmbedUrl(lat, lng, apiKey, { heading, pitch, fov })
  const locationKey = `${Number(lat)},${Number(lng)}`

  const [active, setActive] = useState(0)
  const [slotUrls, setSlotUrls] = useState(() => [targetUrl, null])

  const activeRef = useRef(0)
  const slotUrlsRef = useRef(slotUrls)
  const pendingSlotRef = useRef(null)
  const locationKeyRef = useRef(locationKey)
  const targetUrlRef = useRef(targetUrl)
  const swapTimerRef = useRef(0)

  activeRef.current = active
  slotUrlsRef.current = slotUrls
  targetUrlRef.current = targetUrl

  useEffect(
    () => () => {
      if (swapTimerRef.current) window.clearTimeout(swapTimerRef.current)
    },
    [],
  )

  // New pin: reset frames.
  useEffect(() => {
    if (locationKeyRef.current === locationKey) return
    locationKeyRef.current = locationKey
    pendingSlotRef.current = null
    if (swapTimerRef.current) window.clearTimeout(swapTimerRef.current)
    setActive(0)
    setSlotUrls([targetUrl, null])
  }, [locationKey, targetUrl])

  // POV change: load behind the current frame, swap only after paint delay.
  useEffect(() => {
    if (!targetUrl) return
    if (locationKeyRef.current !== locationKey) return

    const currentActive = activeRef.current
    const currentUrls = slotUrlsRef.current
    if (currentUrls[currentActive] === targetUrl) return
    if (pendingSlotRef.current != null && currentUrls[pendingSlotRef.current] === targetUrl) {
      return
    }

    const next = currentActive === 0 ? 1 : 0
    pendingSlotRef.current = next
    setSlotUrls(prev => {
      if (prev[next] === targetUrl) return prev
      const copy = [...prev]
      copy[next] = targetUrl
      return copy
    })
  }, [targetUrl, locationKey])

  const onFrameLoad = slotIndex => {
    if (pendingSlotRef.current !== slotIndex) return
    if (slotUrlsRef.current[slotIndex] !== targetUrlRef.current) return

    if (swapTimerRef.current) window.clearTimeout(swapTimerRef.current)
    // Keep the previous panorama on top until Google has time to paint the new one.
    swapTimerRef.current = window.setTimeout(() => {
      if (pendingSlotRef.current !== slotIndex) return
      if (slotUrlsRef.current[slotIndex] !== targetUrlRef.current) return
      pendingSlotRef.current = null
      setActive(slotIndex)
    }, EMBED_PAINT_DELAY_MS)
  }

  if (!targetUrl) return null

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {slotUrls.map((src, index) => {
        if (!src) return null
        const isActive = index === active
        // Pending frame stays fully opaque underneath so the browser paints it
        // before we promote it (opacity:0 often skips compositing and causes a black flash).
        return (
          <iframe
            key={`${locationKey}-slot-${index}-${src}`}
            title={isActive ? 'Street view' : 'Street view loading'}
            src={src}
            className={`absolute inset-0 h-full w-full border-0 opacity-100 ${
              isActive ? 'z-20' : 'pointer-events-none z-10'
            }`}
            allowFullScreen={isActive}
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
            aria-hidden={!isActive}
            tabIndex={isActive ? 0 : -1}
            onLoad={() => onFrameLoad(index)}
          />
        )
      })}
    </div>
  )
}
