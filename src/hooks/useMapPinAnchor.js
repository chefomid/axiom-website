import { useEffect, useState } from 'react'

import { parseCoord } from '../utils/coords'

/** Track map zoom and screen position for a single lng/lat pin. */
export default function useMapPinAnchor(map, lat, lng) {
  const [zoom, setZoom] = useState(null)
  const [anchor, setAnchor] = useState(null)

  useEffect(() => {
    if (!map) {
      setZoom(null)
      setAnchor(null)
      return undefined
    }

    const pinLat = parseCoord(lat)
    const pinLng = parseCoord(lng)
    if (pinLat == null || pinLng == null) {
      setAnchor(null)
      return undefined
    }

    const update = () => {
      try {
        setZoom(map.getZoom())
        const point = map.project([pinLng, pinLat])
        setAnchor({ x: point.x, y: point.y })
      } catch {
        /* map mid-style swap */
      }
    }

    update()
    map.on('move', update)
    map.on('zoom', update)
    map.on('resize', update)

    return () => {
      map.off('move', update)
      map.off('zoom', update)
      map.off('resize', update)
    }
  }, [map, lat, lng])

  return { zoom, anchor }
}
