import { useEffect, useRef, useState } from 'react'
import maplibregl from '../../lib/maplibre'
import { MapCornerControls } from '../../lib/mapCornerControls'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAP_STYLE_FALLBACK = 'https://demotiles.maplibre.org/style.json'

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] }

export default function PropertyMap({ lat, lng, label }) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapInitError, setMapInitError] = useState(null)

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return

    setMapInitError(null)
    let map = null
    let styleFallbackUsed = false

    const init = () => {
      map = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [-98.5, 39.8],
        zoom: 3,
        attributionControl: false,
      })
      mapRef.current = map

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
      map.addControl(new MapCornerControls({ maxWidth: 100, unit: 'imperial' }), 'bottom-left')

      map.on('error', e => {
        if (!styleFallbackUsed && e?.error?.message?.includes('style')) {
          styleFallbackUsed = true
          map.setStyle(MAP_STYLE_FALLBACK)
        }
      })

      map.on('load', () => {
        map.addSource('property-pin', { type: 'geojson', data: EMPTY_GEOJSON })
        map.addLayer({
          id: 'property-pin-glow',
          type: 'circle',
          source: 'property-pin',
          paint: {
            'circle-radius': 18,
            'circle-color': '#4a9eff',
            'circle-opacity': 0.2,
            'circle-blur': 0.4,
          },
        })
        map.addLayer({
          id: 'property-pin',
          type: 'circle',
          source: 'property-pin',
          paint: {
            'circle-radius': 8,
            'circle-color': '#4a9eff',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })
        setMapReady(true)
        map.resize()
      })
    }

    init()

    const ro = new ResizeObserver(() => map?.resize())
    ro.observe(container)

    return () => {
      ro.disconnect()
      map?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map?.getSource('property-pin')) return

    if (lat == null || lng == null) {
      map.getSource('property-pin').setData(EMPTY_GEOJSON)
      return
    }

    map.getSource('property-pin').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { label: label ?? '' },
        },
      ],
    })

    map.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 })
  }, [mapReady, lat, lng, label])

  return (
    <div className="command-map-host relative h-full min-h-[280px] w-full bg-[#050505]">
      <div ref={mapContainerRef} className="absolute inset-0" />
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
    </div>
  )
}
