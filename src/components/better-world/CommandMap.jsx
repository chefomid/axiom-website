import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import maplibregl from '../../lib/maplibre'
import { MapCornerControls } from '../../lib/mapCornerControls'
import { COUNTRIES, RISK_LAYERS, SEVERITY_HEX } from '../../data/commandMapData'
import {
  createCirclePolygon,
  geometryCentroid,
  localRadiusLinesGeoJSON,
  zoomForRadiusMiles,
} from '../../utils/geo'
import {
  findPinQuads,
  findPinTriangles,
  formatArea,
  formatBearing,
  formatDistance,
  pinShapesToGeoJSON,
  pinsToGeoJSON,
  segmentsToGeoJSON,
} from '../../utils/mapPins'
import RiskMarkerCard from './RiskMarkerCard'
import ScopeControlBar from './ScopeControlBar'
import ScopeSetupModal from './ScopeSetupModal'
import MapControlsDock from './MapControlsDock'
import FeedErrorBanner from './FeedErrorBanner'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAP_STYLE_FALLBACK = 'https://demotiles.maplibre.org/style.json'
const SCANLINE_STORAGE_KEY = 'axiom-pdc-scanline'

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] }

function readScanlinePreference() {
  try {
    const raw = localStorage.getItem(SCANLINE_STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* ignore */
  }
  return true
}

/** Deep red spokes from user location to in-radius events (local scope). */
const LOCAL_RADIUS_LINE_COLOR = '#7a1212'

/** MapLibre: zoom may only appear in a top-level interpolate/step, not inside case */
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

const LAYER_SHORT_LABEL = Object.fromEntries(RISK_LAYERS.map(l => [l.id, l.shortLabel]))

function flyToMapItem(map, item) {
  if (!item) return

  let lng
  let lat
  let zoom = Math.max(map.getZoom(), 5)

  if (Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
    lng = item.lng
    lat = item.lat
    if (item.geometry) zoom = Math.max(map.getZoom(), 6.5)
    if (item.layer === 'earthquake' && item.mag != null) {
      zoom = Math.max(zoom, item.mag >= 5 ? 7 : item.mag >= 4 ? 6.5 : 6)
    }
  } else if (item.geometry) {
    const centroid = geometryCentroid(item.geometry)
    if (!centroid) return
    lng = centroid.lng
    lat = centroid.lat
    zoom = Math.max(map.getZoom(), 6.5)
  } else {
    return
  }

  map.flyTo({ center: [lng, lat], zoom, duration: 900 })
}

const MIN_SEGMENT_LABEL_PX = 18
const MIN_TRIANGLE_INLINE_AREA_PX = 3200
const SHAPE_ANALYZE_HOVER_MS = 700
const MIN_LABEL_FONT_PX = 6
const MAX_LABEL_FONT_PX = 22

function truncateLabel(text, max = 52) {
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function triangleScreenAreaPx(projectedPoints) {
  const [p0, p1, p2] = projectedPoints
  return Math.abs(
    (p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y)) / 2,
  )
}

function shapeScreenAreaPx(feature, map) {
  const ring = feature.geometry?.coordinates?.[0]
  if (!ring) return 0

  const isQuad = feature.properties?.shape === 'quad'
  const count = isQuad ? 4 : 3
  const pts = ring.slice(0, count).map(([lng, lat]) => map.project([lng, lat]))
  if (pts.length < 3) return 0

  if (isQuad && pts.length >= 4) {
    return (
      triangleScreenAreaPx([pts[0], pts[1], pts[2]]) +
      triangleScreenAreaPx([pts[0], pts[2], pts[3]])
    )
  }

  return triangleScreenAreaPx(pts)
}

function featureShapeCentroid(feature) {
  const ring = feature.geometry?.coordinates?.[0]
  if (!ring) return null

  const isQuad = feature.properties?.shape === 'quad'
  const count = isQuad ? 4 : 3
  if (ring.length < count) return null

  let lat = 0
  let lng = 0
  for (let i = 0; i < count; i += 1) {
    lng += ring[i][0]
    lat += ring[i][1]
  }

  return { lat: lat / count, lng: lng / count }
}

function findOppositePinForEdge(fromId, toId, triangles, quads = []) {
  for (const tri of triangles) {
    const pinIds = tri.pins.map(p => p.id)
    if (pinIds.includes(fromId) && pinIds.includes(toId)) {
      return tri.pins.find(p => p.id !== fromId && p.id !== toId) ?? null
    }
  }
  for (const quad of quads) {
    const pinIds = quad.pins.map(p => p.id)
    if (pinIds.includes(fromId) && pinIds.includes(toId)) {
      return quad.centroid
    }
  }
  return null
}

function normalizeLabelRotation(angleDeg) {
  let rotation = angleDeg
  if (rotation > 90) rotation -= 180
  if (rotation < -90) rotation += 180
  return rotation
}

/** Scale label size with zoom, but never wider than the segment looks on screen. */
function estimateLabelWidthPx(text, fontSize) {
  return text.length * fontSize * 0.52
}

function measureLabelFontSize(zoom, screenLen, labelText) {
  const chars = Math.max(labelText.length, 5)
  const capByLine = (screenLen * 0.68) / (chars * 0.52)
  const floorFromLine = clamp(screenLen / 14, MIN_LABEL_FONT_PX, 14)
  const zoomBoost = clamp(5 + (zoom - 1) * 1.1, 5.5, MAX_LABEL_FONT_PX)
  return clamp(Math.min(capByLine, Math.max(floorFromLine, zoomBoost)), MIN_LABEL_FONT_PX, MAX_LABEL_FONT_PX)
}

function areaLabelFontSize(zoom, triangleScreenArea, labelText) {
  const sideApprox = Math.sqrt(triangleScreenArea)
  const chars = Math.max(labelText.length, 6)
  const capByBounds = (sideApprox * 0.58) / (chars * 0.52)
  const floorFromSize = clamp(sideApprox / 16, MIN_LABEL_FONT_PX, 15)
  const zoomBoost = clamp(5 + (zoom - 1) * 1, 5.5, 18)
  return clamp(Math.min(capByBounds, Math.max(floorFromSize, zoomBoost)), MIN_LABEL_FONT_PX, 20)
}

function measureLabelOffset(fontSize, screenLen) {
  const maxOffset = Math.max(8, screenLen * 0.12)
  return clamp(4 + fontSize * 0.55, 7, Math.min(20, maxOffset))
}

/** Parallel to the segment, offset to the exterior side away from triangle/quad fill. */
function layoutSegmentMeasureLabel(map, segment, pinById, triangles, quads = []) {
  const from = pinById.get(segment.fromId)
  const to = pinById.get(segment.toId)
  if (!from || !to) return null

  const a = map.project([from.lng, from.lat])
  const b = map.project([to.lng, to.lat])
  const mid = map.project([segment.midpoint.lng, segment.midpoint.lat])

  const dx = b.x - a.x
  const dy = b.y - a.y
  const screenLen = Math.hypot(dx, dy)
  if (screenLen < MIN_SEGMENT_LABEL_PX) return null

  const unitLen = screenLen || 1
  let outwardX = -dy / unitLen
  let outwardY = dx / unitLen

  const oppositePin = findOppositePinForEdge(segment.fromId, segment.toId, triangles, quads)
  if (oppositePin) {
    const interior = map.project([oppositePin.lng, oppositePin.lat])
    const toInteriorX = interior.x - mid.x
    const toInteriorY = interior.y - mid.y
    const dot = outwardX * toInteriorX + outwardY * toInteriorY
    if (dot > 0) {
      outwardX = -outwardX
      outwardY = -outwardY
    }
  } else if (outwardY < 0) {
    outwardX = -outwardX
    outwardY = -outwardY
  }

  const zoom = map.getZoom()
  const distanceText = formatDistance(segment.distanceMiles)
  let labelText = distanceText
  let showBearing = Number.isFinite(segment.bearing)

  if (showBearing) {
    const withBearing = `${distanceText} · ${formatBearing(segment.bearing)}`
    const bearingFont = measureLabelFontSize(zoom, screenLen, withBearing)
    if (estimateLabelWidthPx(withBearing, bearingFont) <= screenLen * 0.78) {
      labelText = withBearing
    } else {
      showBearing = false
    }
  }

  const fontSize = measureLabelFontSize(zoom, screenLen, labelText)
  if (estimateLabelWidthPx(labelText, fontSize) > screenLen * 0.92) return null

  const offset = measureLabelOffset(fontSize, screenLen)
  const rotation = normalizeLabelRotation((Math.atan2(dy, dx) * 180) / Math.PI)

  return {
    id: segment.id,
    kind: 'segment',
    x: mid.x + outwardX * offset,
    y: mid.y + outwardY * offset,
    fontSize,
    rotation,
    distance: segment.distanceMiles,
    bearing: showBearing ? segment.bearing : null,
  }
}

function layoutShapeAreaLabel(map, shape) {
  const pts = shape.pins.map(p => map.project([p.lng, p.lat]))
  const screenArea =
    shape.pins.length === 4
      ? triangleScreenAreaPx([pts[0], pts[1], pts[2]]) + triangleScreenAreaPx([pts[0], pts[2], pts[3]])
      : triangleScreenAreaPx(pts)
  if (screenArea < MIN_TRIANGLE_INLINE_AREA_PX) return null

  const areaText = formatArea(shape.areaSqMiles)
  const fontSize = areaLabelFontSize(map.getZoom(), screenArea, areaText)
  const sideApprox = Math.sqrt(screenArea)
  if (estimateLabelWidthPx(areaText, fontSize) > sideApprox * 0.95) return null

  const point = map.project([shape.centroid.lng, shape.centroid.lat])

  return {
    id: `area-${shape.id}`,
    kind: 'area',
    x: point.x,
    y: point.y,
    fontSize,
    areaSqMiles: shape.areaSqMiles,
  }
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
          color: SEVERITY_HEX[zone.severity] ?? SEVERITY_HEX.live,
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
          color: SEVERITY_HEX[marker.severity] ?? SEVERITY_HEX.live,
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
  scopeApplyKey = 0,
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
  analysisOpen = false,
  onOpenAnalysis,
  pinMode = false,
  pins = [],
  segments = [],
  selectedPinId = null,
  onAddPin,
  onSelectPin,
  onRemovePin,
  onRemoveShape,
  onMovePin,
  onAnalyzeAtPin,
  onTogglePinMode,
  onClearPins,
  onMakeSquare,
  onBreakPinChain,
  onBreakPinChainBlocked,
  pinCount = 0,
}) {
  const [scanlineOn, setScanlineOn] = useState(readScanlinePreference)

  const handleToggleScanline = () => {
    setScanlineOn(prev => {
      const next = !prev
      try {
        localStorage.setItem(SCANLINE_STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)
  const eventsBoundRef = useRef(false)
  const onSelectRef = useRef(onSelectMarker)
  const onAddPinRef = useRef(onAddPin)
  const onSelectPinRef = useRef(onSelectPin)
  const onRemovePinRef = useRef(onRemovePin)
  const onRemoveShapeRef = useRef(onRemoveShape)
  const onMovePinRef = useRef(onMovePin)
  const onAnalyzeAtPinRef = useRef(onAnalyzeAtPin)
  const usgsEnabledRef = useRef(usgsEnabled)
  const onBreakPinChainRef = useRef(onBreakPinChain)
  const onBreakPinChainBlockedRef = useRef(onBreakPinChainBlocked)
  const pinModeRef = useRef(pinMode)
  const pinDragRef = useRef({ id: null, moved: false, startX: 0, startY: 0 })
  const pinDragJustEndedRef = useRef(false)
  const shapeClickRef = useRef(false)
  const triangleAreaPopupRef = useRef(null)
  const shapeAnalyzePromptRef = useRef(null)
  const shapeHoverTimerRef = useRef(null)
  const hoveredShapeForAnalyzeRef = useRef(null)
  const hoveredTriangleIdRef = useRef(null)
  const markersByIdRef = useRef(new Map())
  const pinsByIdRef = useRef(new Map())
  const lastFlownMarkerIdRef = useRef(null)
  const pendingFlyMarkerIdRef = useRef(null)
  const setHoverTipRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapInitError, setMapInitError] = useState(null)
  const [hoverTip, setHoverTip] = useState(null)
  const [measureLabels, setMeasureLabels] = useState([])
  const [triangleAreaPopup, setTriangleAreaPopup] = useState(null)
  const [shapeAnalyzePrompt, setShapeAnalyzePrompt] = useState(null)
  const [mapViewZoom, setMapViewZoom] = useState(1.8)

  onSelectRef.current = onSelectMarker
  onAddPinRef.current = onAddPin
  onSelectPinRef.current = onSelectPin
  onRemovePinRef.current = onRemovePin
  onRemoveShapeRef.current = onRemoveShape
  onMovePinRef.current = onMovePin
  onAnalyzeAtPinRef.current = onAnalyzeAtPin
  usgsEnabledRef.current = usgsEnabled
  onBreakPinChainRef.current = onBreakPinChain
  onBreakPinChainBlockedRef.current = onBreakPinChainBlocked
  pinModeRef.current = pinMode
  setHoverTipRef.current = setHoverTip
  triangleAreaPopupRef.current = setTriangleAreaPopup
  shapeAnalyzePromptRef.current = setShapeAnalyzePrompt

  useEffect(() => {
    if (pins.length === 0) {
      setTriangleAreaPopup(null)
      setShapeAnalyzePrompt(null)
    }
  }, [pins.length])

  useEffect(() => {
    setTriangleAreaPopup(null)
    setShapeAnalyzePrompt(null)
  }, [segments, pins])

  useEffect(() => {
    markersByIdRef.current = new Map([
      ...markers.map(m => [m.id, m]),
      ...zones.map(z => [z.id, z]),
    ])
  }, [markers, zones])

  useEffect(() => {
    pinsByIdRef.current = new Map(pins.map(p => [p.id, p]))
  }, [pins])

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
  const pinQuads = useMemo(() => findPinQuads(pins, segments), [pins, segments])

  const userPinShapesGeoJson = useMemo(
    () => pinShapesToGeoJSON(pinTriangles, pinQuads),
    [pinTriangles, pinQuads],
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
            'case',
            ['==', ['get', 'selected'], true],
            '#ffe566',
            ['get', 'color'],
          ],
          'fill-opacity': ['case', ['==', ['get', 'selected'], true], 0.52, 0.2],
        },
      })
      map.addLayer({
        id: 'risk-zones-line',
        type: 'line',
        source: 'risk-zones',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'selected'], true],
            '#ffffff',
            ['get', 'color'],
          ],
          'line-width': ['case', ['==', ['get', 'selected'], true], 2.5, 1],
          'line-opacity': ['case', ['==', ['get', 'selected'], true], 0.95, 0.65],
        },
      })
      map.addLayer({
        id: 'risk-zones-selected-outline',
        type: 'line',
        source: 'risk-zones',
        filter: ['==', ['get', 'selected'], true],
        paint: {
          'line-color': '#ffffff',
          'line-width': 4,
          'line-opacity': 1,
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

      map.addSource('user-pin-triangles', {
        type: 'geojson',
        data: EMPTY_GEOJSON,
        promoteId: 'id',
      })
      map.addLayer({
        id: 'user-pin-triangles-fill',
        type: 'fill',
        source: 'user-pin-triangles',
        paint: {
          'fill-color': '#e8a838',
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.2,
            0.08,
          ],
        },
      })
      map.addLayer({
        id: 'user-pin-triangles-hover-outline',
        type: 'line',
        source: 'user-pin-triangles',
        paint: {
          'line-color': '#e8a838',
          'line-width': 1.25,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.55,
            0,
          ],
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
        const marker = markersByIdRef.current.get(id)
        if (marker) flyToMapItem(map, marker)
        else
          map.flyTo({
            center: e.lngLat,
            zoom: Math.max(map.getZoom(), 5),
            duration: 900,
          })
      })

      map.on('click', 'risk-zones-fill', e => {
        if (pinModeRef.current) return
        const id = e.features?.[0]?.properties?.id
        if (!id) return
        onSelectRef.current(id)
        const zone = markersByIdRef.current.get(id)
        if (zone) flyToMapItem(map, zone)
      })

      const PIN_DRAG_THRESHOLD_PX = 5
      const PIN_HIT_PADDING_PX = 14

      const hasPinNearPoint = point => {
        const pinFeatures = map.queryRenderedFeatures(
          [
            [point.x - PIN_HIT_PADDING_PX, point.y - PIN_HIT_PADDING_PX],
            [point.x + PIN_HIT_PADDING_PX, point.y + PIN_HIT_PADDING_PX],
          ],
          { layers: ['user-pins'] },
        )
        return pinFeatures.length > 0
      }

      map.on('mousedown', 'user-pins', e => {
        if (!pinModeRef.current) return
        if (e.originalEvent.button !== 0) return
        const id = e.features?.[0]?.properties?.id
        if (!id) return
        e.preventDefault()
        pinDragRef.current = {
          id,
          moved: false,
          startX: e.point.x,
          startY: e.point.y,
        }
        map.dragPan.disable()
        map.getCanvas().style.cursor = 'grabbing'
      })

      map.on('mousemove', e => {
        const drag = pinDragRef.current
        if (!drag.id) return
        const dx = e.point.x - drag.startX
        const dy = e.point.y - drag.startY
        if (!drag.moved && Math.hypot(dx, dy) < PIN_DRAG_THRESHOLD_PX) return
        drag.moved = true
        onMovePinRef.current?.(drag.id, e.lngLat.lat, e.lngLat.lng)
      })

      const endPinDrag = () => {
        const drag = pinDragRef.current
        if (!drag.id) return
        pinDragJustEndedRef.current = drag.moved
        map.dragPan.enable()
        map.getCanvas().style.cursor = ''
        pinDragRef.current = { id: null, moved: false, startX: 0, startY: 0 }
      }

      map.on('mouseup', endPinDrag)
      map.on('mouseout', endPinDrag)

      map.on('click', 'user-pin-triangles-fill', e => {
        shapeClickRef.current = true

        const feature = e.features?.[0]
        if (!feature?.geometry?.coordinates?.[0]) return

        const areaSqMiles = Number(feature.properties?.areaSqMiles)
        if (!Number.isFinite(areaSqMiles)) return

        const screenArea = shapeScreenAreaPx(feature, map)
        const shapeId = feature.properties?.id

        triangleAreaPopupRef.current?.(prev => {
          if (prev?.id === shapeId) return null
          return {
            id: shapeId,
            x: e.point.x,
            y: e.point.y,
            areaSqMiles,
            screenArea,
          }
        })
      })

      map.on('click', e => {
        if (shapeClickRef.current) {
          shapeClickRef.current = false
          return
        }

        const shapeFeatures = map.queryRenderedFeatures(e.point, {
          layers: ['user-pin-triangles-fill'],
        })
        if (shapeFeatures.length === 0) {
          triangleAreaPopupRef.current?.(null)
        }

        if (!pinModeRef.current) return
        if (pinDragJustEndedRef.current) {
          pinDragJustEndedRef.current = false
          return
        }

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

      map.on('dblclick', 'user-pins', e => {
        if (!pinModeRef.current) return
        e.preventDefault()
        const id = e.features?.[0]?.properties?.id
        if (!id) return
        const pin = pinsByIdRef.current.get(id)
        if (pin) onAnalyzeAtPinRef.current?.(pin)
      })

      map.on('contextmenu', 'user-pins', e => {
        e.preventDefault()
        const id = e.features?.[0]?.properties?.id
        if (!id) return
        pinDragRef.current = { id: null, moved: false, startX: 0, startY: 0 }
        map.dragPan.enable()
        onRemovePinRef.current?.(id)
      })

      map.on('contextmenu', 'user-pin-triangles-fill', e => {
        e.preventDefault()
        const shapeId = e.features?.[0]?.properties?.id
        if (!shapeId) return
        clearShapeAnalyzePrompt()
        triangleAreaPopupRef.current?.(null)
        onRemoveShapeRef.current?.(shapeId)
      })

      map.on('contextmenu', e => {
        if (!pinModeRef.current) return
        e.preventDefault()

        const shapeFeatures = map.queryRenderedFeatures(e.point, {
          layers: ['user-pin-triangles-fill'],
        })
        if (shapeFeatures.length > 0) return

        if (hasPinNearPoint(e.point)) {
          onBreakPinChainBlockedRef.current?.()
          return
        }

        onBreakPinChainRef.current?.()
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

      const clearTriangleHoverState = () => {
        const hoveredId = hoveredTriangleIdRef.current
        if (hoveredId == null) return
        try {
          map.setFeatureState({ source: 'user-pin-triangles', id: hoveredId }, { hover: false })
        } catch {
          /* feature may have been removed */
        }
        hoveredTriangleIdRef.current = null
      }

      const clearShapeHoverTimer = () => {
        if (shapeHoverTimerRef.current == null) return
        clearTimeout(shapeHoverTimerRef.current)
        shapeHoverTimerRef.current = null
      }

      const clearShapeAnalyzePrompt = () => {
        clearShapeHoverTimer()
        hoveredShapeForAnalyzeRef.current = null
        shapeAnalyzePromptRef.current?.(null)
      }

      map.on('mousemove', 'user-pin-triangles-fill', e => {
        const feature = e.features?.[0]
        if (!feature?.properties?.id) return

        const id = feature.properties.id
        if (id !== hoveredTriangleIdRef.current) {
          clearTriangleHoverState()
          hoveredTriangleIdRef.current = id
          map.setFeatureState({ source: 'user-pin-triangles', id }, { hover: true })
        }

        map.getCanvas().style.cursor = 'pointer'

        if (!usgsEnabledRef.current || id === hoveredShapeForAnalyzeRef.current) return

        clearShapeHoverTimer()
        shapeAnalyzePromptRef.current?.(null)
        hoveredShapeForAnalyzeRef.current = id

        const centroid = featureShapeCentroid(feature)
        if (!centroid) return

        const areaSqMiles = Number(feature.properties?.areaSqMiles)
        const point = { x: e.point.x, y: e.point.y }

        shapeHoverTimerRef.current = setTimeout(() => {
          if (hoveredShapeForAnalyzeRef.current !== id) return
          shapeAnalyzePromptRef.current?.({
            id,
            x: point.x,
            y: point.y,
            lat: centroid.lat,
            lng: centroid.lng,
            areaSqMiles,
          })
        }, SHAPE_ANALYZE_HOVER_MS)
      })

      map.on('mouseleave', 'user-pin-triangles-fill', () => {
        clearTriangleHoverState()
        clearShapeAnalyzePrompt()
        setMapCursor()
      })

      map.on('mouseenter', 'user-pins', setMapCursor)
      map.on('mouseleave', 'user-pins', setMapCursor)

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
        center: [-20, 30],
        zoom: 1.8,
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
      if (trianglesSource) {
        if (hoveredTriangleIdRef.current != null) {
          hoveredTriangleIdRef.current = null
          try {
            map.removeFeatureState({ source: 'user-pin-triangles' })
          } catch {
            /* source may not have state yet */
          }
        }
        trianglesSource.setData(userPinShapesGeoJson)
      }
    } catch (err) {
      console.error('Failed to update user pins:', err)
    }
  }, [userPinsGeoJson, userPinLinesGeoJson, userPinShapesGeoJson, mapReady])

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
      const pinById = new Map(pins.map(p => [p.id, p]))
      const triangles = findPinTriangles(pins, segments)
      const quads = findPinQuads(pins, segments)
      const segmentLabels = segments
        .map(seg => layoutSegmentMeasureLabel(map, seg, pinById, triangles, quads))
        .filter(Boolean)
      const areaLabels = [...triangles, ...quads]
        .map(shape => layoutShapeAreaLabel(map, shape))
        .filter(Boolean)
      setMeasureLabels([...segmentLabels, ...areaLabels])
      setMapViewZoom(map.getZoom())
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
  }, [segments, pins, mapReady])

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
    if (!map || !mapReady || !map.getLayer('nfhl-raster-layer')) return

    const selected = zones.find(z => z.id === selectedMarkerId)
    const dimRaster = selected?.layer === 'flood'
    map.setPaintProperty('nfhl-raster-layer', 'raster-opacity', dimRaster ? 0.18 : 0.45)
  }, [selectedMarkerId, zones, mapReady])

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
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, mapReady, scopeApplyKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !selectedMarkerId) {
      lastFlownMarkerIdRef.current = null
      pendingFlyMarkerIdRef.current = null
      return
    }

    const item = markersByIdRef.current.get(selectedMarkerId)
    if (!item) {
      pendingFlyMarkerIdRef.current = selectedMarkerId
      return
    }

    const shouldFly =
      lastFlownMarkerIdRef.current !== selectedMarkerId ||
      pendingFlyMarkerIdRef.current === selectedMarkerId
    if (!shouldFly) return

    lastFlownMarkerIdRef.current = selectedMarkerId
    pendingFlyMarkerIdRef.current = null
    flyToMapItem(map, item)
  }, [selectedMarkerId, mapReady, markers, zones])

  useEffect(
    () => () => {
      if (shapeHoverTimerRef.current) clearTimeout(shapeHoverTimerRef.current)
    },
    [],
  )

  const handleShapeAnalyzeClick = () => {
    if (!shapeAnalyzePrompt) return
    const label = Number.isFinite(shapeAnalyzePrompt.areaSqMiles)
      ? `Region (${formatArea(shapeAnalyzePrompt.areaSqMiles)})`
      : 'Region'
    onAnalyzeAtPin?.({
      lat: shapeAnalyzePrompt.lat,
      lng: shapeAnalyzePrompt.lng,
      label,
    })
    setShapeAnalyzePrompt(null)
    hoveredShapeForAnalyzeRef.current = null
  }

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

      {/* Scanline lives inside the map host so corner controls (z-index above) stay on top. */}
      {mapReady &&
        mapContainerRef.current &&
        createPortal(
          <div
            className={`command-scanline${scanlineOn ? '' : ' command-scanline--off'}`}
            aria-hidden
          >
            <div className="command-scanline__beam" />
          </div>,
          mapContainerRef.current,
        )}

      {measureLabels.map(label => (
        <div
          key={label.id}
          className={`map-measure-label${label.kind === 'area' ? ' map-measure-label--area' : ''}`}
          style={{
            left: label.x,
            top: label.y,
            fontSize: label.fontSize,
            transform:
              label.rotation != null
                ? `translate(-50%, -50%) rotate(${label.rotation}deg)`
                : 'translate(-50%, -50%)',
          }}
          role="note"
        >
          {label.kind === 'area' ? (
            formatArea(label.areaSqMiles)
          ) : (
            <>
              {formatDistance(label.distance)}
              {Number.isFinite(label.bearing) && (
                <>
                  <span className="map-measure-label__sep"> · </span>
                  <span className="map-measure-label__bearing">{formatBearing(label.bearing)}</span>
                </>
              )}
            </>
          )}
        </div>
      ))}

      {triangleAreaPopup && Number.isFinite(triangleAreaPopup.areaSqMiles) && (
        <div
          className="map-triangle-area-popup"
          style={{
            left: triangleAreaPopup.x,
            top: triangleAreaPopup.y,
            fontSize: areaLabelFontSize(
              mapViewZoom,
              triangleAreaPopup.screenArea || MIN_TRIANGLE_INLINE_AREA_PX,
              formatArea(triangleAreaPopup.areaSqMiles),
            ),
          }}
          role="tooltip"
        >
          {formatArea(triangleAreaPopup.areaSqMiles)}
        </div>
      )}

      {shapeAnalyzePrompt && usgsEnabled && (
        <div
          className="map-shape-analyze-prompt"
          style={{ left: shapeAnalyzePrompt.x, top: shapeAnalyzePrompt.y }}
        >
          <button
            type="button"
            className="map-shape-analyze-prompt__btn"
            onClick={handleShapeAnalyzeClick}
          >
            Analyze
          </button>
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
        eventCount={markers.length + (zoneCount ?? 0)}
        onOpenModal={onOpenScopeModal}
        onRadiusChange={miles => onScopeChange?.({ radiusMiles: miles })}
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
        analysisOpen={analysisOpen}
        onOpenAnalysis={onOpenAnalysis}
        pinMode={pinMode}
        onTogglePinMode={onTogglePinMode}
        pinCount={pinCount}
        onClearPins={onClearPins}
        onMakeSquare={onMakeSquare}
        onBreakPinChain={onBreakPinChain}
        pins={pins}
        selectedPinId={selectedPinId}
        onAnalyzeAtPin={onAnalyzeAtPin}
      />

      <button
        type="button"
        className={`command-scan-toggle${scanlineOn ? ' is-on' : ''}`}
        onClick={handleToggleScanline}
        aria-pressed={scanlineOn}
        title={scanlineOn ? 'Hide scan bar' : 'Show scan bar'}
        aria-label={scanlineOn ? 'Hide scan bar' : 'Show scan bar'}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
          <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
          <circle cx="12" cy="12" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
          <path
            d="M12 12 L12 3.5 A8.5 8.5 0 0 1 19.4 16.2 Z"
            fill="currentColor"
            opacity="0.55"
          />
          <circle cx="12" cy="12" r="1.35" fill="currentColor" />
        </svg>
      </button>

      {liveFeedErrors.length > 0 && (
        <div className="absolute left-3 top-16 z-20 flex max-w-xs flex-col gap-1.5">
          {liveFeedErrors.map(({ source, message, retryAt, stale, lastFetchedAt }) => (
            <FeedErrorBanner
              key={source}
              source={source}
              message={message}
              retryAt={retryAt}
              stale={stale}
              lastFetchedAt={lastFetchedAt}
            />
          ))}
        </div>
      )}

      <ScopeSetupModal
        open={scopeModalOpen}
        initialScope={scope}
        initialRadiusMiles={radiusMiles}
        initialCountryId={countryId}
        initialUserLocation={userLocation}
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
