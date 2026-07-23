import { useEffect, useRef, useState } from 'react'
import { googleStreetViewEmbedUrl } from '../../services/propertyImagery'

/**
 * Embed Street View without black shutter on POV changes.
 * Keeps the current iframe visible until the next URL finishes loading.
 */
export default function StreetViewEmbedFrame({ lat, lng, apiKey, heading, pitch, fov }) {
  const targetUrl = googleStreetViewEmbedUrl(lat, lng, apiKey, { heading, pitch, fov })
  const locationKey = `${Number(lat)},${Number(lng)}`

  const [active, setActive] = useState(0)
  const [slotUrls, setSlotUrls] = useState(() => [targetUrl, null])

  const activeRef = useRef(0)
  const slotUrlsRef = useRef(slotUrls)
  const pendingSlotRef = useRef(null)
  const locationKeyRef = useRef(locationKey)
  const targetUrlRef = useRef(targetUrl)

  activeRef.current = active
  slotUrlsRef.current = slotUrls
  targetUrlRef.current = targetUrl

  // New pin: show a fresh frame immediately.
  useEffect(() => {
    if (locationKeyRef.current === locationKey) return
    locationKeyRef.current = locationKey
    pendingSlotRef.current = null
    setActive(0)
    setSlotUrls([targetUrl, null])
  }, [locationKey, targetUrl])

  // POV / FOV change: preload in the hidden slot, then swap.
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
    pendingSlotRef.current = null
    setActive(slotIndex)
  }

  if (!targetUrl) return null

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {slotUrls.map((src, index) => {
        if (!src) return null
        const isActive = index === active
        return (
          <iframe
            key={`${locationKey}-slot-${index}-${src}`}
            title={isActive ? 'Street view' : 'Street view loading'}
            src={src}
            className={`absolute inset-0 h-full w-full border-0 ${
              isActive ? 'z-[1] opacity-100' : 'pointer-events-none z-0 opacity-0'
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
