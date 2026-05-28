import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import maplibregl from '../../lib/maplibre'
import { MapCornerControls } from '../../lib/mapCornerControls'
import { COUNTRIES, RISK_LAYERS } from '../../data/commandMapData'
import {
  createCirclePolygon,
  localRadiusLinesGeoJSON,
  zoomForRadiusMiles,
} from '../../utils/geo'
import {
  findPinTriangles,
  formatArea,
  formatBearing,
  formatDistance,
  pinTrianglesToGeoJSON,
  pinsToGeoJSON,
  segmentsToGeoJSON,
} from '../../utils/mapPins'
import RiskMarkerCard from './RiskMarkerCard'
import ScopeControlBar from './ScopeControlBar'
import ScopeSetupModal from './ScopeSetupModal'
import MapControlsDock from './MapControlsDock'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAP_STYLE_FALLBACK = 'https://demotiles.maplibre.org/style.json'

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] }

/** Deep red spokes from user location to in-radius events (local scope). */
const LOCAL_RADIUS_LINE_COLOR = '#7a1212'

/** MapLibre: zoom may only appear in a top-level interpolate/step — not inside case */
const USER_PIN_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  2,
  ['case', ['==', ['get', 'selected'], true], 10, 8],
  5,
  ['case', ['==', ['get', 'selected'], true], 9, 6.5],
  8,
  ['case', ['==', ['get', 'selected'], true], 8, 5],
  12,
  ['case', ['==', ['get', 'selected'], true], 7, 4],
]

const RISK_POINT_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  2,
  ['case', ['==', ['get', 'selected'], true], 9, ['get', 'pointRadius']],
  5,
  ['case', ['==', ['get', 'selected'], true], 9, ['+', ['get', 'pointRadius'], 1.5]],
  8,
  ['case', ['==', ['get', 'selected'], true], 9, ['+', ['get', 'pointRadius'], 2.5]],
  12,
  ['case', ['==', ['get', 'selected'], true], 9, ['+', ['get', 'pointRadius'], 3.5]],
]

const SEVERITY_COLORS = {
  stable: '#3dd68c',
  live: '#4a9eff',
  watch: '#e8a838',
  critical: '#e05252',
}

const LAYER_SHORT_LABEL = Object.fromEntries(RISK_LAYERS.map(l => [l.id, l.shortLabel]))

function truncateLabel(text, max = 52) {
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function zonesToGeoJSON(zones, selectedMarkerId) {
  return {
    type: 'FeatureCollection',
    features: zones
      .filter(z => z.geometry)
      .map(zone => ({
        type: 'Feature',
        geometry: zone.geometry,
        properties: {
          id: zone.id,
          layer: zone.layer,
          severity: zone.severity,
          color: SEVERITY_COLORS[zone.severity] ?? SEVERITY_COLORS.live,
          selected: zone.id === selectedMarkerId,
        },
      })),
  }
}

function markersToGeoJSON(markers, selectedMarkerId) {
  return {
    type: 'FeatureCollection',
    features: markers
      .filter(m => Number.isFinite(m.lng) && Number.isFinite(m.lat))
      .map(marker => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [marker.lng, marker.lat] },
        properties: {
          id: marker.id,
          color: SEVERITY_COLORS[marker.severity] ?? SEVERITY_COLORS.live,
          selected: marker.id === selectedMarkerId,
          pointRadius: marker.pointRadius ?? 5,
        },
      })),
  }
}

export default function CommandMap({
  className = '',
  markers,
  zones = [],
  nfhlRaster = null,
  scope,
  radiusMiles,
  countryId,
  userLocation,
  selectedMarkerId,
  onSelectMarker,
  onScopeApply,
  onScopeChange,
  scopeModalOpen,
  onOpenScopeModal,
  onCloseScopeModal,
  activeLayers,
  onToggleLayer,
  onToggleSource,
  onEnableAllLayers,
  onClearAllLayers,
  activeDataSources,
  layerCounts,
  layerLoading = {},
  liveFeedErrors = [],
  minEarthquakeMag,
  onMinEarthquakeMagChange,
  earthquakeCount,
  usgsEnabled,
  zoneCount = 0,
  pinMode = false,
  pins = [],
  segments = [],
  selectedPinId = null,
  onAddPin,
  onSelectPin,
  onRemovePin,
  onTogglePinMode,
  onClearPins,
  pinCount = 0,
}) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)
  const eventsBoundRef = useRef(false)
  const onSelectRef = useRef(onSelectMarker)
  const onAddPinRef = useRef(onAddPin)
  const onSelectPinRef = useRef(onSelectPin)
  const onRemovePinRef = useRef(onRemovePin)
  const pinModeRef = useRef(pinMode)
  const markersByIdRef = useRef(new Map())
  const setHoverTipRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapInitError, setMapInitError] = useState(null)
  const [hoverTip, setHoverTip] = useState(null)
  const [triangleHover, setTriangleHover] = useState(null)
  const [measureLabels, setMeasureLabels] = useState([])

  onSelectRef.current = onSelectMarker
  onAddPinRef.current = onAddPin
  onSelectPinRef.current = onSelectPin
  onRemovePinRef.current = onRemovePin
  pinModeRef.current = pinMode
  setHoverTipRef.current = setHoverTip

  useEffect(() => {
    markersByIdRef.current = new Map(markers.map(m => [m.id, m]))
  }, [markers])

  const geoJson = useMemo(
    () => markersToGeoJSON(markers, selectedMarkerId),
    [markers, selectedMarkerId],
  )

  const zonesGeoJson = useMemo(
    () => zonesToGeoJSON(zones, selectedMarkerId),
    [zones, selectedMarkerId],
  )

  const localLinesGeoJson = useMemo(() => {
    if (scope !== 'local' || !userLocation) return EMPTY_GEOJSON
    return localRadiusLinesGeoJSON(userLocation, markers, zones, radiusMiles)
  }, [scope, userLocation, markers, zones, radiusMiles])

  const userPinsGeoJson = useMemo(
    () => pinsToGeoJSON(pins, selectedPinId),
    [pins, selectedPinId],
  )

  const userPinLinesGeoJson = useMemo(
    () => segmentsToGeoJSON(segments, pins),
    [segments, pins],
  )

  const pinTriangles = useMemo(() => findPinTriangles(pins, segments), [pins, segments])

  const userPinTrianglesGeoJson = useMemo(
    () => pinTrianglesToGeoJSON(pinTriangles),
    [pinTriangles],
  )

  const allSelectable = useMemo(() => [...markers, ...zones], [markers, zones])

  const selectedMarker = useMemo(
    () => allSelectable.find(m => m.id === selectedMarkerId) ?? null,
    [allSelectable, selectedMarkerId],
  )

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return

    setMapInitError(null)

    let map = null
    let ro = null
    let styleFallbackUsed = false

    const scheduleResize = () => {
      map?.resize()
    }

    const addRiskLayers = () => {
      if (!map || map.getSource('risk-events')) return

      map.addSource('scope-radius', { type: 'geojson', data: EMPTY_GEOJSON })
      map.addLayer({
        id: 'scope-radius-fill',
        type: 'fill',
        source: 'scope-radius',
        paint: { 'fill-color': '#3dd68c', 'fill-opacity': 0.06 },
      })
      map.addLayer({
        id: 'scope-radius-line',
        type: 'line',
        source: 'scope-radius',
        paint: { 'line-color': '#3dd68c', 'line-width': 1.5, 'line-opacity': 0.45 },
      })

      map.addSource('local-radius-lines', { type: 'geojson', data: EMPTY_GEOJSON })
      map.addLayer({
        id: 'local-radius-lines',
        type: 'line',
        source: 'local-radius-lines',
        paint: {
          'line-color': LOCAL_RADIUS_LINE_COLOR,
          'line-width': 1.25,
          'line-opacity': 0.72,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })

      map.addSource('risk-zones', { type: 'geojson', data: EMPTY_GEOJSON })
      map.addLayer({
        id: 'risk-zones-fill',
        type: 'fill',
        source: 'risk-zones',
        paint: {
          'fill-color': [
            'match',
            ['get', 'layer'],
            'weather',
            '#e8a838',
            'flood',
            '#4a9eff',
            '#888888',
          ],
          'fill-opacity': ['case', ['==', ['get', 'selected'], true], 0.35, 0.18],
        },
      })
      map.addLayer({
        id: 'risk-zones-line',
        type: 'line',
        source: 'risk-zones',
        paint: {
          'line-color': [
            'match',
            ['get', 'layer'],
            'weather',
            '#e8a838',
            'flood',
            '#4a9eff',
            '#aaaaaa',
          ],
          'line-width': ['case', ['==', ['get', 'selected'], true], 2.5, 1.2],
          'line-opacity': 0.75,
        },
      })

      map.addSource('risk-events', { type: 'geojson', data: EMPTY_GEOJSON })
      map.addLayer({
        id: 'risk-points',
        type: 'circle',
        source: 'risk-events',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': RISK_POINT_RADIUS,
          'circle-stroke-width': ['case', ['==', ['get', 'selected'], true], 2, 0.75],
          'circle-stroke-color': '#ffffff',
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.55, 8, 0.85, 12, 0.95],
        },
      })

      map.addSource('user-pin-lines', { type: 'geojson', data: EMPTY_GEOJSON })
      map.addLayer({
        id: 'user-pin-lines',
        type: 'line',
        source: 'user-pin-lines',
        paint: {
          'line-color': '#e8a838',
          'line-width': 1.25,
          'line-opacity': 0.65,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })

      map.addSource('user-pin-triangles', { type: 'geojson', data: EMPTY_GEOJSON })
      map.addLayer({
        id: 'user-pin-triangles-fill',
        type: 'fill',
        source: 'user-pin-triangles',
        paint: {
          'fill-color': '#e8a838',
          'fill-opacity': 0.08,
        },
      })

      map.addSource('user-pins', { type: 'geojson', data: EMPTY_GEOJSON })
      map.addLayer({
        id: 'user-pins',
        type: 'circle',
        source: 'user-pins',
        paint: {
          'circle-color': 'rgba(232, 168, 56, 0.35)',
          'circle-radius': USER_PIN_RADIUS,
          'circle-stroke-width': ['case', ['==', ['get', 'selected'], true], 2.5, 1.75],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'selected'], true],
            '#ffffff',
            '#e8a838',
          ],
          'circle-opacity': 0.95,
        },
      })

      const clearHoverTip = () => setHoverTipRef.current?.(null)

      const setMapCursor = () => {
        const canvas = map.getCanvas()
        if (pinModeRef.current) {
          canvas.classList.add('map-canvas--pin-mode')
          canvas.style.cursor = ''
        } else {
          canvas.classList.remove('map-canvas--pin-mode')
          canvas.style.cursor = ''
        }
      }

      const bindLayerPointer = (layerId, cursor) => {
        map.on('mouseenter', layerId, () => {
          if (pinModeRef.current) {
            setMapCursor()
            return
          }
          map.getCanvas().style.cursor = cursor
        })
        map.on('mouseleave', layerId, () => {
          setMapCursor()
        })
      }

      map.on('click', 'risk-points', e => {
        if (pinModeRef.current) return
        const id = e.features?.[0]?.properties?.id
        if (!id) return
        onSelectRef.current(id)
        map.flyTo({
          center: e.lngLat,
          zoom: Math.max(map.getZoom(), 5),
          duration: 900,
        })
      })

      map.on('click', 'risk-zones-fill', e => {
        if (pinModeRef.current) return
        const id = e.features?.[0]?.properties?.id
        if (id) onSelectRef.current(id)
      })

      map.on('click', e => {
        if (!pinModeRef.current) return
        const pinFeatures = map.queryRenderedFeatures(e.point, { layers: ['user-pins'] })
        if (pinFeatures.length > 0) {
          const id = pinFeatures[0].properties?.id
          if (id) onSelectPinRef.current?.(id)
          return
        }
        const hazardFeatures = map.queryRenderedFeatures(e.point, {
          layers: ['risk-points', 'risk-zones-fill'],
        })
        if (hazardFeatures.length > 0) return
        onAddPinRef.current?.(e.lngLat.lat, e.lngLat.lng)
      })

      map.on('contextmenu', e => {
        if (!pinModeRef.current) return
        e.preventDefault()
        const pinFeatures = map.queryRenderedFeatures(e.point, { layers: ['user-pins'] })
        if (pinFeatures.length === 0) return
        const id = pinFeatures[0].properties?.id
        if (id) onRemovePinRef.current?.(id)
      })

      map.on('mousemove', 'risk-points', e => {
        if (pinModeRef.current) {
          clearHoverTip()
          return
        }
        const feature = e.features?.[0]
        if (!feature) {
          clearHoverTip()
          return
        }
        const marker = markersByIdRef.current.get(feature.properties.id)
        if (!marker) {
          clearHoverTip()
          return
        }
        setHoverTipRef.current?.({
          x: e.point.x,
          y: e.point.y,
          title: marker.title,
          layer: marker.layer,
          severity: marker.severity,
        })
      })
      map.on('mouseleave', 'risk-points', clearHoverTip)
      map.on('mouseout', clearHoverTip)

      map.on('mouseenter', 'user-pins', setMapCursor)
      map.on('mouseleave', 'user-pins', setMapCursor)

      const clearTriangleHover = () => setTriangleHover(null)

      map.on('mousemove', 'user-pin-triangles-fill', e => {
        const feature = e.features?.[0]
        if (!feature) {
          clearTriangleHover()
          return
        }
        const areaSqMiles = Number(feature.properties?.areaSqMiles)
        setTriangleHover({
          x: e.point.x,
          y: e.point.y,
          areaSqMiles: Number.isFinite(areaSqMiles) ? areaSqMiles : null,
        })
        map.getCanvas().style.cursor = 'crosshair'
      })
      map.on('mouseleave', 'user-pin-triangles-fill', () => {
        clearTriangleHover()
        setMapCursor()
      })

      bindLayerPointer('risk-points', 'pointer')
      bindLayerPointer('risk-zones-fill', 'pointer')
      eventsBoundRef.current = true
      setMapReady(true)
      scheduleResize()
    }

    const startMap = () => {
      if (map) return
      const { clientWidth, clientHeight } = container
      if (clientWidth < 50 || clientHeight < 50) return

      map = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [-98.5, 39.8],
        zoom: 3.4,
        minZoom: 2,
        maxZoom: 14,
        attributionControl: false,
      })

      map.addControl(new MapCornerControls({ maxWidth: 100, unit: 'imperial' }), 'bottom-left')
      mapRef.current = map

      map.on('error', e => {
        const msg = e.error?.message ?? ''
        console.error('MapLibre error:', e.error)
        if (!styleFallbackUsed && msg) {
          styleFallbackUsed = true
          map.setStyle(MAP_STYLE_FALLBACK)
          return
        }
        setMapInitError(msg || 'Map rendering error')
      })

      map.on('load', () => {
        scheduleResize()
        addRiskLayers()
      })

      map.on('style.load', () => {
        eventsBoundRef.current = false
        scheduleResize()
        addRiskLayers()
      })
    }

    ro = new ResizeObserver(() => {
      startMap()
      scheduleResize()
    })
    ro.observe(container)
    startMap()

    return () => {
      ro.disconnect()
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      map?.remove()
      mapRef.current = null
      eventsBoundRef.current = false
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    try {
      const source = map.getSource('risk-events')
      if (source) source.setData(geoJson)
    } catch (err) {
      console.error('Failed to update risk-events:', err)
    }
  }, [geoJson, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    try {
      const source = map.getSource('risk-zones')
      if (source) source.setData(zonesGeoJson)
    } catch (err) {
      console.error('Failed to update risk-zones:', err)
    }
  }, [zonesGeoJson, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    try {
      const source = map.getSource('local-radius-lines')
      if (source) source.setData(localLinesGeoJson)
    } catch (err) {
      console.error('Failed to update local-radius-lines:', err)
    }
  }, [localLinesGeoJson, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    try {
      const pinsSource = map.getSource('user-pins')
      if (pinsSource) pinsSource.setData(userPinsGeoJson)
      const linesSource = map.getSource('user-pin-lines')
      if (linesSource) linesSource.setData(userPinLinesGeoJson)
      const trianglesSource = map.getSource('user-pin-triangles')
      if (trianglesSource) trianglesSource.setData(userPinTrianglesGeoJson)
    } catch (err) {
      console.error('Failed to update user pins:', err)
    }
  }, [userPinsGeoJson, userPinLinesGeoJson, userPinTrianglesGeoJson, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const opacity = pinMode
      ? ['interpolate', ['linear'], ['zoom'], 2, 0.28, 8, 0.42, 12, 0.5]
      : ['interpolate', ['linear'], ['zoom'], 2, 0.55, 8, 0.85, 12, 0.95]

    try {
      if (map.getLayer('risk-points')) {
        map.setPaintProperty('risk-points', 'circle-opacity', opacity)
      }
      const canvas = map.getCanvas()
      if (pinMode) {
        canvas.classList.add('map-canvas--pin-mode')
        canvas.style.cursor = ''
      } else {
        canvas.classList.remove('map-canvas--pin-mode')
        canvas.style.cursor = ''
      }
    } catch (err) {
      console.error('Failed to update pin mode paint:', err)
    }
  }, [pinMode, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const updateMeasureLabels = () => {
      setMeasureLabels(
        segments.map(seg => {
          const point = map.project([seg.midpoint.lng, seg.midpoint.lat])
          return {
            id: seg.id,
            x: point.x,
            y: point.y,
            distance: seg.distanceMiles,
            bearing: seg.bearing,
          }
        }),
      )
    }

    updateMeasureLabels()
    map.on('move', updateMeasureLabels)
    map.on('zoom', updateMeasureLabels)
    map.on('resize', updateMeasureLabels)

    return () => {
      map.off('move', updateMeasureLabels)
      map.off('zoom', updateMeasureLabels)
      map.off('resize', updateMeasureLabels)
    }
  }, [segments, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !map.isStyleLoaded()) return

    try {
      if (!nfhlRaster?.url || !nfhlRaster?.bbox) {
        if (map.getLayer('nfhl-raster-layer')) map.removeLayer('nfhl-raster-layer')
        if (map.getSource('nfhl-raster')) map.removeSource('nfhl-raster')
        return
      }

      const { west, south, east, north } = nfhlRaster.bbox
      const coords = [
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ]

      if (map.getSource('nfhl-raster')) {
        map.getSource('nfhl-raster').updateImage({ url: nfhlRaster.url, coordinates: coords })
      } else if (map.getLayer('risk-zones-fill')) {
        map.addSource('nfhl-raster', {
          type: 'image',
          url: nfhlRaster.url,
          coordinates: coords,
        })
        map.addLayer(
          {
            id: 'nfhl-raster-layer',
            type: 'raster',
            source: 'nfhl-raster',
            paint: { 'raster-opacity': 0.45 },
          },
          'risk-zones-fill',
        )
      }
    } catch (err) {
      console.error('Failed to update NFHL raster:', err)
    }
  }, [nfhlRaster, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const id = window.requestAnimationFrame(() => map.resize())
    return () => window.cancelAnimationFrame(id)
  }, [mapReady, markers.length, zones.length])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const source = map.getSource('scope-radius')
    if (!source) return

    if (scope === 'local' && userLocation) {
      source.setData(createCirclePolygon(userLocation, radiusMiles))
    } else {
      source.setData(EMPTY_GEOJSON)
    }
  }, [scope, userLocation, radiusMiles, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    userMarkerRef.current?.remove()
    userMarkerRef.current = null

    if (scope === 'local' && userLocation) {
      const el = document.createElement('span')
      el.className = 'command-map-user-dot'
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map)
    }
  }, [scope, userLocation, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (scope === 'local' && userLocation) {
      map.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: zoomForRadiusMiles(radiusMiles),
        duration: 1000,
      })
      return
    }

    if (scope === 'national') {
      const country = COUNTRIES.find(c => c.id === countryId)
      if (country) {
        map.flyTo({ center: country.center, zoom: country.zoom, duration: 1000 })
      }
      return
    }

    if (scope === 'global') {
      map.flyTo({ center: [-20, 30], zoom: 1.8, duration: 1000 })
    }
  }, [scope, userLocation, radiusMiles, countryId, mapReady])

  if (mapInitError) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-[#0a0a0a] p-6 text-center ${className}`}
      >
        <p className="font-mono text-[11px] text-command-critical">Map could not start</p>
        <p className="font-mono text-[10px] text-ink-muted">{mapInitError}</p>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden bg-[#0a0a0a] ${className}`}>
      <div ref={mapContainerRef} className="command-map-host" />

      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.35)_100%)]" />

      <div className="command-scanline pointer-events-none absolute inset-0 z-[2]">
        <div className="command-scanline__beam" />
      </div>

      {measureLabels.map(label => (
        <div
          key={label.id}
          className="map-measure-tooltip"
          style={{ left: label.x, top: label.y }}
          role="tooltip"
        >
          <span className="map-measure-tooltip__meta">Measure</span>
          <span className="map-measure-tooltip__title">{formatDistance(label.distance)}</span>
          {Number.isFinite(label.bearing) && (
            <span className="map-measure-tooltip__bearing">{formatBearing(label.bearing)}</span>
          )}
        </div>
      ))}

      {triangleHover && Number.isFinite(triangleHover.areaSqMiles) && (
        <div
          className="map-measure-tooltip"
          style={{ left: triangleHover.x, top: triangleHover.y }}
          role="tooltip"
        >
          <span className="map-measure-tooltip__meta">Area</span>
          <span className="map-measure-tooltip__title">
            {formatArea(triangleHover.areaSqMiles)}
          </span>
        </div>
      )}

      {hoverTip && !pinMode && (
        <div
          className="map-point-tooltip"
          style={{ left: hoverTip.x, top: hoverTip.y }}
          role="tooltip"
        >
          <span className="map-point-tooltip__meta">
            <span
              className={`map-point-tooltip__dot map-point-tooltip__dot--${hoverTip.severity}`}
              aria-hidden
            />
            {LAYER_SHORT_LABEL[hoverTip.layer] ?? hoverTip.layer}
          </span>
          <span className="map-point-tooltip__title">{truncateLabel(hoverTip.title)}</span>
        </div>
      )}

      <ScopeControlBar
        scope={scope}
        radiusMiles={radiusMiles}
        countryId={countryId}
        userLocation={userLocation}
        eventCount={markers.length}
        onOpenModal={onOpenScopeModal}
      />

      <MapControlsDock
        activeLayers={activeLayers}
        onToggleLayer={onToggleLayer}
        onEnableAllLayers={onEnableAllLayers}
        onClearAllLayers={onClearAllLayers}
        activeDataSources={activeDataSources}
        onToggleSource={onToggleSource}
        layerCounts={layerCounts}
        layerLoading={layerLoading}
        visibleCount={markers.length}
        zoneCount={zoneCount}
        minEarthquakeMag={minEarthquakeMag}
        onMinEarthquakeMagChange={onMinEarthquakeMagChange}
        earthquakeCount={earthquakeCount}
        usgsEnabled={usgsEnabled}
        pinMode={pinMode}
        onTogglePinMode={onTogglePinMode}
        pinCount={pinCount}
        onClearPins={onClearPins}
      />

      {liveFeedErrors.length > 0 && (
        <div className="absolute left-3 top-16 z-20 flex max-w-xs flex-col gap-1">
          {liveFeedErrors.map(({ source, message }) => (
            <p
              key={source}
              className="rounded border border-command-critical/40 bg-[#0d0d0d]/90 px-2 py-1 font-mono text-[9px] text-command-critical backdrop-blur-sm"
            >
              {source} feed: {message}
            </p>
          ))}
        </div>
      )}

      <ScopeSetupModal
        open={scopeModalOpen}
        initialScope={scope}
        initialRadiusMiles={radiusMiles}
        initialCountryId={countryId}
        onApply={onScopeApply}
        onClose={onCloseScopeModal}
      />

      <AnimatePresence>
        {selectedMarker && (
          <RiskMarkerCard
            key={selectedMarker.id}
            marker={selectedMarker}
            onClose={() => onSelectMarker(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
