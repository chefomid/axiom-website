import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from '../../lib/maplibre'
import { MapCornerControls } from '../../lib/mapCornerControls'
import { ANALYTICS_RADIUS_BREAKPOINTS, LAYER_COLORS, SEVERITY_HEX } from '../../data/commandMapData'
import {
  getAllFaultLines,
  getFaultInfoFromFeature,
  preloadFaultLineDots,
  preloadFaultLines,
} from '../../services/faultLines'
import {
  bboxToBounds,
  circleBounds,
  createCirclePolygon,
  createRingPolygon,
  distanceMiles,
  eventsBounds,
} from '../../utils/geo'
import { COMMAND_MAP_STYLE } from '../../utils/mapBasemaps'

const MAP_VIEW_PADDING = { top: 64, bottom: 72, left: 120, right: 44 }

function viewportKey(center, maxRadiusMiles, recenterKey = 0) {
  if (!center) return null
  return `${center.lat.toFixed(5)}|${center.lng.toFixed(5)}|${maxRadiusMiles}|r${recenterKey}`
}

function maxZoomForRadius(maxRadiusMiles) {
  if (maxRadiusMiles >= 1250) return 4.2
  if (maxRadiusMiles >= 750) return 4.8
  if (maxRadiusMiles >= 500) return 5.2
  if (maxRadiusMiles >= 250) return 5.5
  return 6.5
}

const COUNTRY_OVERVIEW_MAX_ZOOM = 3.4

function flyDurationMs(fromCenter, toCenter) {
  if (!fromCenter || !toCenter) return 1200
  const jumpMiles = distanceMiles(fromCenter, toCenter)
  if (jumpMiles >= 1200) return 2000
  if (jumpMiles >= 400) return 1500
  if (jumpMiles >= 80) return 1200
  return 900
}

const EQ_COLOR = LAYER_COLORS.earthquake
const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] }

/** Gold styling for the innermost radius unit when a home address is selected. */
const HOME_UNIT_FILL = '#c49628'
const HOME_UNIT_LINE = '#c9a840'
const HOME_UNIT_FILL_OPACITY = 0.20
const UNIT_BAND_FILL = 'rgba(160, 160, 160, 0.06)'

const EQ_POINT_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  ['*', ['get', 'pointRadius'], 0.55],
  5,
  ['*', ['get', 'pointRadius'], 0.8],
  6,
  ['*', ['get', 'pointRadius'], 1.05],
  8,
  ['*', ['get', 'pointRadius'], 1.45],
]

/** Dark-map frequency stain, deep crimson intensity = event density. */
const ROAD_STAIN_HEATMAP_COLOR = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0,
  'rgba(0,0,0,0)',
  0.01,
  'rgba(72, 8, 12, 0.14)',
  0.06,
  'rgba(96, 12, 16, 0.28)',
  0.14,
  'rgba(118, 16, 20, 0.42)',
  0.26,
  'rgba(138, 22, 24, 0.54)',
  0.42,
  'rgba(152, 26, 28, 0.62)',
  0.62,
  'rgba(162, 30, 32, 0.68)',
  0.82,
  'rgba(168, 32, 34, 0.72)',
  1,
  'rgba(172, 34, 36, 0.75)',
]

/** Per-point crimson bleed, stacks into stained clusters. */
const ROAD_STAIN_GLOW_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  ['*', ['get', 'pointRadius'], 1.75],
  5,
  ['*', ['get', 'pointRadius'], 2.05],
  6,
  ['*', ['get', 'pointRadius'], 2.35],
  8,
  ['*', ['get', 'pointRadius'], 2.85],
]

const ROAD_STAIN_GLOW_COLOR = 'rgba(118, 16, 20, 0.42)'

function magToColor(mag) {
  if (mag == null) return SEVERITY_HEX.stable
  if (mag >= 6) return SEVERITY_HEX.critical
  if (mag >= 5) return SEVERITY_HEX.watch
  if (mag >= 4) return EQ_COLOR
  if (mag >= 3) return SEVERITY_HEX.live
  return SEVERITY_HEX.stable
}

function magToPointRadius(mag, maxRadiusMiles, worldwide = false) {
  const safeMag = mag ?? 2.5
  if (worldwide) {
    return Math.max(3, Math.min(9, safeMag * 1.05))
  }
  const radiusScale = Math.max(250 / Math.max(maxRadiusMiles, 1), 0.5)
  return Math.max(4.5, Math.min(14, safeMag * 1.35 * Math.sqrt(radiusScale)))
}

function eventsToGeoJSON(events, center, maxRadiusMiles, skipRadiusFilter = false) {
  return {
    type: 'FeatureCollection',
    features: events
      .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng))
      .filter(e => skipRadiusFilter || !center || distanceMiles(center, e) <= maxRadiusMiles)
      .map((event, index) => {
        const mag = event.mag ?? 2.5
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [event.lng, event.lat] },
          properties: {
            id: `eq-${index}-${event.time ?? index}`,
            mag,
            color: magToColor(mag),
            pointRadius: magToPointRadius(mag, maxRadiusMiles, skipRadiusFilter),
            weight: Math.max(0.12, Math.min(1, (mag - 2) / 4.5)),
            stainWeight: 1,
          },
        }
      }),
  }
}

function buildRadiusGeoJSON(center, maxRadiusMiles, breakpoints = [], highlightHomeUnit = false) {
  if (!center) return EMPTY_GEOJSON

  const features = []
  const seen = new Set()

  if (highlightHomeUnit) {
    const sorted = [...breakpoints]
      .filter(m => Number.isFinite(m) && m > 0 && m <= maxRadiusMiles)
      .sort((a, b) => a - b)

    if (sorted.length > 0) {
      const homeRadius = sorted[0]
      features.push({
        ...createCirclePolygon(center, homeRadius),
        properties: {
          kind: 'home-unit',
          radius: homeRadius,
          label: `0–${homeRadius} mi`,
        },
      })

      for (let i = 1; i < sorted.length; i += 1) {
        features.push({
          ...createRingPolygon(center, sorted[i - 1], sorted[i]),
          properties: {
            kind: 'unit-band',
            inner: sorted[i - 1],
            radius: sorted[i],
            label: `${sorted[i - 1]}–${sorted[i]} mi`,
          },
        })
      }

      const lastBreakpoint = sorted[sorted.length - 1]
      if (lastBreakpoint < maxRadiusMiles) {
        features.push({
          ...createRingPolygon(center, lastBreakpoint, maxRadiusMiles),
          properties: {
            kind: 'unit-band',
            inner: lastBreakpoint,
            radius: maxRadiusMiles,
            label: `${lastBreakpoint}–${maxRadiusMiles} mi`,
          },
        })
      }
    }
  }

  for (const miles of breakpoints) {
    if (!Number.isFinite(miles) || miles <= 0 || miles > maxRadiusMiles || seen.has(miles)) continue
    seen.add(miles)
    features.push({
      ...createCirclePolygon(center, miles),
      properties: { kind: 'breakpoint', radius: miles },
    })
  }

  if (!seen.has(maxRadiusMiles)) {
    features.push({
      ...createCirclePolygon(center, maxRadiusMiles),
      properties: { kind: 'outer', radius: maxRadiusMiles },
    })
  }

  return { type: 'FeatureCollection', features }
}

function setupAnalysisLayers(map) {
  if (!map.getSource('analysis-radius')) {
    map.addSource('analysis-radius', { type: 'geojson', data: EMPTY_GEOJSON })
  }

  if (!map.getLayer('analysis-radius-unit-fill')) {
    map.addLayer({
      id: 'analysis-radius-unit-fill',
      type: 'fill',
      source: 'analysis-radius',
      filter: ['==', ['get', 'kind'], 'unit-band'],
      paint: { 'fill-color': UNIT_BAND_FILL, 'fill-opacity': 1 },
    })
  }

  if (!map.getLayer('analysis-radius-home-fill')) {
    map.addLayer({
      id: 'analysis-radius-home-fill',
      type: 'fill',
      source: 'analysis-radius',
      filter: ['==', ['get', 'kind'], 'home-unit'],
      paint: { 'fill-color': HOME_UNIT_FILL, 'fill-opacity': HOME_UNIT_FILL_OPACITY },
    })
  }

  if (!map.getLayer('analysis-radius-sweet-fill')) {
    map.addLayer({
      id: 'analysis-radius-sweet-fill',
      type: 'fill',
      source: 'analysis-radius',
      filter: ['==', ['get', 'kind'], 'sweet'],
      paint: { 'fill-color': '#ff9348', 'fill-opacity': 0.06 },
    })
  }

  if (!map.getLayer('analysis-radius-home-line')) {
    map.addLayer({
      id: 'analysis-radius-home-line',
      type: 'line',
      source: 'analysis-radius',
      filter: ['==', ['get', 'kind'], 'home-unit'],
      paint: {
        'line-color': HOME_UNIT_LINE,
        'line-width': 2,
        'line-opacity': 0.95,
      },
    })
  }

  if (!map.getLayer('analysis-radius-breakpoints')) {
    map.addLayer({
      id: 'analysis-radius-breakpoints',
      type: 'line',
      source: 'analysis-radius',
      filter: ['==', ['get', 'kind'], 'breakpoint'],
      paint: {
        'line-color': 'rgba(160, 160, 160, 0.45)',
        'line-width': 0.85,
        'line-dasharray': [3, 4],
      },
    })
  }

  if (!map.getLayer('analysis-radius-lines')) {
    map.addLayer({
      id: 'analysis-radius-lines',
      type: 'line',
      source: 'analysis-radius',
      filter: ['in', ['get', 'kind'], ['literal', ['outer', 'sweet']]],
      paint: {
        'line-color': [
          'match',
          ['get', 'kind'],
          'outer',
          'rgba(255, 147, 72, 0.55)',
          'rgba(255, 147, 72, 0.4)',
        ],
        'line-width': ['match', ['get', 'kind'], 'outer', 1.35, 1],
      },
    })
  }

  if (!map.getSource('analysis-center')) {
    map.addSource('analysis-center', { type: 'geojson', data: EMPTY_GEOJSON })
  }

  if (!map.getSource('eq-events')) {
    map.addSource('eq-events', { type: 'geojson', data: EMPTY_GEOJSON })
  }

  if (!map.getSource('fault-lines')) {
    map.addSource('fault-lines', { type: 'geojson', data: EMPTY_GEOJSON })
  }

  if (!map.getLayer('eq-heatmap')) {
    map.addLayer({
      id: 'eq-heatmap',
      type: 'heatmap',
      source: 'eq-events',
      paint: {
        'heatmap-weight': ['get', 'stainWeight'],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.95, 5, 1.15, 6, 1.25, 8, 1.55],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 16, 5, 22, 6, 28, 8, 36],
        'heatmap-color': ROAD_STAIN_HEATMAP_COLOR,
        'heatmap-opacity': 0.65,
      },
    })
  }

  if (!map.getLayer('eq-events-glow')) {
    map.addLayer({
      id: 'eq-events-glow',
      type: 'circle',
      source: 'eq-events',
      paint: {
        'circle-color': ROAD_STAIN_GLOW_COLOR,
        'circle-radius': ROAD_STAIN_GLOW_RADIUS,
        'circle-opacity': 0.44,
        'circle-blur': 0.85,
      },
    })
  }

  if (!map.getLayer('eq-events')) {
    map.addLayer({
      id: 'eq-events',
      type: 'circle',
      source: 'eq-events',
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': EQ_POINT_RADIUS,
        'circle-stroke-width': 1.15,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.92,
      },
    })
  }

  if (!map.getLayer('fault-zones-glow')) {
    map.addLayer({
      id: 'fault-zones-glow',
      type: 'line',
      source: 'fault-lines',
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e05252',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 4, 4, 6, 6, 8, 8, 10],
        'line-opacity': 0.22,
        'line-blur': 1.2,
      },
    })
  }

  if (!map.getLayer('fault-zones')) {
    map.addLayer({
      id: 'fault-zones',
      type: 'line',
      source: 'fault-lines',
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e05252',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.2, 4, 1.8, 6, 2.4, 8, 3],
        'line-opacity': 0.94,
      },
    })
  }

  if (!map.getLayer('analysis-home-pin-glow')) {
    map.addLayer({
      id: 'analysis-home-pin-glow',
      type: 'circle',
      source: 'analysis-center',
      paint: {
        'circle-radius': 16,
        'circle-color': HOME_UNIT_FILL,
        'circle-opacity': 0.32,
        'circle-blur': 0.55,
      },
    })
  }

  if (!map.getLayer('analysis-home-pin')) {
    map.addLayer({
      id: 'analysis-home-pin',
      type: 'circle',
      source: 'analysis-center',
      paint: {
        'circle-radius': 6,
        'circle-color': HOME_UNIT_LINE,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1,
      },
    })
  }

  if (!map.getLayer('fault-zones-hit')) {
    map.addLayer({
      id: 'fault-zones-hit',
      type: 'line',
      source: 'fault-lines',
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e05252',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 10, 4, 14, 6, 18, 8, 22],
        'line-opacity': 0.01,
      },
    })
  }

  ensureFaultLayersOnTop(map)
}

/** Keep fault visuals and the wide hit target above quake markers. */
function ensureFaultLayersOnTop(map) {
  for (const layerId of ['fault-zones-glow', 'fault-zones', 'fault-zones-hit']) {
    if (!map.getLayer(layerId)) continue
    try {
      map.moveLayer(layerId)
    } catch {
      /* layer order may already be correct */
    }
  }
}

/** Crimson density stain under magnitude-colored event markers. */
function applyFrequencyDisplayMode(map) {
  if (!map?.getLayer('eq-heatmap')) return

  map.setLayoutProperty('eq-heatmap', 'visibility', 'visible')
  map.setLayoutProperty('eq-events-glow', 'visibility', 'visible')
  map.setLayoutProperty('eq-events', 'visibility', 'visible')

  map.setPaintProperty('eq-heatmap', 'heatmap-color', ROAD_STAIN_HEATMAP_COLOR)
  map.setPaintProperty('eq-heatmap', 'heatmap-weight', ['get', 'stainWeight'])
  map.setPaintProperty('eq-heatmap', 'heatmap-opacity', 0.65)
  map.setPaintProperty('eq-heatmap', 'heatmap-intensity', [
    'interpolate',
    ['linear'],
    ['zoom'],
    4,
    0.95,
    5,
    1.15,
    6,
    1.25,
    8,
    1.55,
  ])
  map.setPaintProperty('eq-heatmap', 'heatmap-radius', [
    'interpolate',
    ['linear'],
    ['zoom'],
    4,
    16,
    5,
    22,
    6,
    28,
    8,
    36,
  ])

  map.setPaintProperty('eq-events-glow', 'circle-color', ['get', 'color'])
  map.setPaintProperty('eq-events-glow', 'circle-radius', ROAD_STAIN_GLOW_RADIUS)
  map.setPaintProperty('eq-events-glow', 'circle-opacity', 0.38)
  map.setPaintProperty('eq-events-glow', 'circle-blur', 0.75)

  map.setPaintProperty('eq-events', 'circle-color', ['get', 'color'])
  map.setPaintProperty('eq-events', 'circle-radius', EQ_POINT_RADIUS)
  map.setPaintProperty('eq-events', 'circle-stroke-width', 1.15)
  map.setPaintProperty('eq-events', 'circle-stroke-color', '#ffffff')
  map.setPaintProperty('eq-events', 'circle-opacity', 0.92)
}

function setFaultLinesVisibility(map, visible) {
  if (!map?.getLayer('fault-zones')) return
  const layout = visible ? 'visible' : 'none'
  map.setLayoutProperty('fault-zones-glow', 'visibility', layout)
  map.setLayoutProperty('fault-zones', 'visibility', layout)
  if (map.getLayer('fault-zones-hit')) {
    map.setLayoutProperty('fault-zones-hit', 'visibility', layout)
  }
}

function syncFaultLineSource(map) {
  const source = map?.getSource('fault-lines')
  if (!source) return
  source.setData(getAllFaultLines())
}

const FAULT_HIT_LAYERS = ['fault-zones-hit', 'fault-zones']
const FAULT_HIT_PAD_PX = 6

function pickFaultFeatureAtPoint(map, point) {
  if (!map?.getLayer('fault-zones-hit')) return null
  const layers = FAULT_HIT_LAYERS.filter(id => map.getLayer(id))
  if (!layers.length) return null

  let features = map.queryRenderedFeatures(point, { layers })
  if (!features.length) {
    const pad = FAULT_HIT_PAD_PX
    features = map.queryRenderedFeatures(
      [
        [point.x - pad, point.y - pad],
        [point.x + pad, point.y + pad],
      ],
      { layers },
    )
  }
  return features[0] ?? null
}

function bindFaultLineInteractions(map, refs) {
  if (!map || refs.bound) return
  refs.bound = true

  const clearFaultHover = () => {
    refs.setHoverTip(null)
    if (map.getCanvas()) map.getCanvas().style.cursor = ''
  }

  const showFaultHover = (feature, point, lngLat) => {
    const info = getFaultInfoFromFeature(feature, lngLat)
    if (!info?.displayName) {
      clearFaultHover()
      return
    }

    refs.setHoverTip({
      x: point.x,
      y: point.y,
      displayName: info.displayName,
      referenceUrl: info.referenceUrl,
      referenceSource: info.referenceSource,
    })
    map.getCanvas().style.cursor = 'pointer'
  }

  map.on('mousemove', e => {
    if (!refs.showFaultLines) {
      clearFaultHover()
      return
    }

    const feature = pickFaultFeatureAtPoint(map, e.point)
    if (!feature) {
      clearFaultHover()
      return
    }

    showFaultHover(feature, e.point, e.lngLat)
  })

  map.on('mouseout', () => {
    clearFaultHover()
  })

  map.on('click', e => {
    if (!refs.showFaultLines) return

    const feature = pickFaultFeatureAtPoint(map, e.point)
    if (!feature) return

    const info = getFaultInfoFromFeature(feature, e.lngLat)
    if (!info?.referenceUrl) return

    window.open(info.referenceUrl, '_blank', 'noopener,noreferrer')
  })
}

export default function EarthquakeAnalysisMap({
  center,
  label,
  recenterKey = 0,
  events = [],
  maxRadiusMiles = ANALYTICS_RADIUS_BREAKPOINTS[ANALYTICS_RADIUS_BREAKPOINTS.length - 1],
  radiusBreakpoints = ANALYTICS_RADIUS_BREAKPOINTS,
  showFaultLines = false,
  onFaultLinesChange,
  nationalAnalysis = false,
  countryOverviewAnalysis = false,
  countryBbox = null,
  globalAnalysis = false,
  highlightHomeUnit = false,
  yearPresetLabel = '',
  layoutRevision = '',
}) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const cornerControlsRef = useRef(null)
  const onFaultLinesToggleRef = useRef(() => {})
  const showFaultLinesRef = useRef(showFaultLines)
  const faultLineEventsRef = useRef({ bound: false, showFaultLines: false, setHoverTip: () => {} })
  const [faultHoverTip, setFaultHoverTip] = useState(null)
  const suppressStyleFlyRef = useRef(false)
  const prevCenterRef = useRef(null)
  const viewportKeyRef = useRef(null)
  const recenterKeyRef = useRef(recenterKey)
  const lastFlownRecenterKeyRef = useRef(-1)
  const flyParamsRef = useRef({})
  const dataRef = useRef({})
  const bindAnalysisLayersRef = useRef(() => {})
  const syncMapDataRef = useRef(() => {})
  const scheduleSyncMapDataRef = useRef(() => {})
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    preloadFaultLineDots()
    preloadFaultLines()
  }, [])

  onFaultLinesToggleRef.current = () => {
    const next = !showFaultLinesRef.current
    showFaultLinesRef.current = next
    const map = mapRef.current
    if (map?.getLayer('fault-zones')) {
      syncFaultLineSource(map)
      setFaultLinesVisibility(map, next)
    }
    onFaultLinesChange?.(next)
  }

  showFaultLinesRef.current = showFaultLines
  faultLineEventsRef.current.showFaultLines = showFaultLines
  faultLineEventsRef.current.setHoverTip = setFaultHoverTip

  const ensureFaultLineData = useCallback(map => {
    if (!map?.getSource('fault-lines')) return
    if (getAllFaultLines().features.length > 0) {
      syncFaultLineSource(map)
      return
    }
    preloadFaultLines().then(() => {
      if (!mapRef.current) return
      syncFaultLineSource(mapRef.current)
      if (showFaultLinesRef.current) {
        setFaultLinesVisibility(mapRef.current, true)
      }
    })
  }, [])

  const flyToAnalysisView = useCallback(
    (
      map,
      {
        center: nextCenter,
        maxRadiusMiles: radius,
        fromCenter,
        animate,
        global,
        national = false,
        countryOverview = false,
        countryBbox: overviewBbox = null,
        eventList = [],
      },
    ) => {
      if (!map || !nextCenter || !map.isStyleLoaded()) return false

      const duration = animate ? flyDurationMs(fromCenter, nextCenter) : 0

      if (global) {
        const bounds = eventsBounds(eventList)
        if (bounds) {
          map.fitBounds(bounds, {
            padding: MAP_VIEW_PADDING,
            duration,
            maxZoom: 3.2,
            essential: true,
          })
        } else {
          map.flyTo({
            center: [-20, 20],
            zoom: 1.6,
            duration,
            essential: true,
          })
        }
      } else if (countryOverview && overviewBbox) {
        const bounds = bboxToBounds(overviewBbox)
        if (bounds) {
          map.fitBounds(bounds, {
            padding: MAP_VIEW_PADDING,
            duration,
            maxZoom: COUNTRY_OVERVIEW_MAX_ZOOM,
            essential: true,
          })
        }
      } else if (national) {
        map.fitBounds(circleBounds(nextCenter, radius), {
          padding: MAP_VIEW_PADDING,
          duration,
          maxZoom: maxZoomForRadius(radius),
          essential: true,
        })
      } else {
        map.flyTo({
          center: [nextCenter.lng, nextCenter.lat],
          zoom: maxZoomForRadius(radius),
          duration,
          essential: true,
        })
      }

      if (map.getPitch() !== 0 || map.getBearing() !== 0) {
        map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: animate && duration > 0 ? 600 : 0,
        })
      }

      return true
    },
    [],
  )

  const flyToRef = useRef(flyToAnalysisView)
  flyToRef.current = flyToAnalysisView

  const eventGeoJSON = useMemo(
    () => eventsToGeoJSON(events, center, maxRadiusMiles, globalAnalysis),
    [events, center, maxRadiusMiles, globalAnalysis],
  )

  const radiusGeoJSON = useMemo(
    () =>
      globalAnalysis
        ? EMPTY_GEOJSON
        : buildRadiusGeoJSON(center, maxRadiusMiles, radiusBreakpoints, highlightHomeUnit),
    [globalAnalysis, center, maxRadiusMiles, radiusBreakpoints, highlightHomeUnit],
  )

  const centerGeoJSON = useMemo(() => {
    if (!highlightHomeUnit || !center || globalAnalysis) return EMPTY_GEOJSON
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [center.lng, center.lat] },
          properties: { kind: 'home-pin' },
        },
      ],
    }
  }, [highlightHomeUnit, center, globalAnalysis])

  recenterKeyRef.current = recenterKey
  flyParamsRef.current = {
    center,
    maxRadiusMiles,
    nationalAnalysis,
    countryOverviewAnalysis,
    countryBbox,
    globalAnalysis,
    events,
    recenterKey,
  }
  dataRef.current = {
    eventGeoJSON,
    radiusGeoJSON,
    centerGeoJSON,
    center,
    maxRadiusMiles,
    nationalAnalysis,
    countryOverviewAnalysis,
    countryBbox,
    globalAnalysis,
    events,
  }

  const syncMapData = useCallback(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return

    const { eventGeoJSON: geo, radiusGeoJSON: radius, centerGeoJSON: centerPin } = dataRef.current
    const eventsSource = map.getSource('eq-events')
    const radiusSource = map.getSource('analysis-radius')
    const centerSource = map.getSource('analysis-center')
    if (!eventsSource || !radiusSource || !geo || !radius) return

    eventsSource.setData(geo)
    radiusSource.setData(radius)
    centerSource?.setData(centerPin ?? EMPTY_GEOJSON)
    map.triggerRepaint()
  }, [])

  const bindAnalysisLayers = useCallback(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return false

    try {
      setupAnalysisLayers(map)
      applyFrequencyDisplayMode(map)
      ensureFaultLineData(map)
      setFaultLinesVisibility(map, showFaultLinesRef.current)
      bindFaultLineInteractions(map, faultLineEventsRef.current)
      syncMapDataRef.current()
      return true
    } catch (err) {
      console.error('Earthquake analysis map layers failed:', err)
      return false
    }
  }, [ensureFaultLineData])

  bindAnalysisLayersRef.current = bindAnalysisLayers
  syncMapDataRef.current = syncMapData

  const scheduleSyncMapData = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    const runSync = () => {
      const activeMap = mapRef.current
      if (!activeMap?.isStyleLoaded()) return

      if (!activeMap.getSource('eq-events')) {
        bindAnalysisLayersRef.current()
      } else {
        syncMapDataRef.current()
      }
    }

    if (map.isStyleLoaded()) {
      runSync()
      return
    }

    map.once('idle', runSync)
    map.once('styledata', runSync)
  }, [])

  scheduleSyncMapDataRef.current = scheduleSyncMapData

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return undefined

    let map = null
    let ro = null

    const scheduleResize = () => {
      if (!map) return
      requestAnimationFrame(() => map.resize())
    }

    const onMapLoad = () => {
      setMapReady(true)
      scheduleResize()

      try {
        bindAnalysisLayersRef.current()
        scheduleSyncMapDataRef.current()

        const {
          center: c,
          maxRadiusMiles: radius,
          globalAnalysis: isGlobal,
          nationalAnalysis: isNational,
          countryOverviewAnalysis: isCountryOverview,
          countryBbox: overviewBbox,
          events: eventList,
        } = dataRef.current
        const activeRecenterKey = recenterKeyRef.current
        if (!suppressStyleFlyRef.current && c) {
          flyToRef.current(map, {
            center: c,
            maxRadiusMiles: radius,
            fromCenter: null,
            animate: false,
            global: isGlobal,
            national: isNational,
            countryOverview: isCountryOverview,
            countryBbox: overviewBbox,
            eventList,
          })
          viewportKeyRef.current = isGlobal
            ? `global-${eventList.length}|r${activeRecenterKey}`
            : viewportKey(c, radius, activeRecenterKey)
          lastFlownRecenterKeyRef.current = activeRecenterKey
          prevCenterRef.current = c
        }
      } catch (err) {
        console.error('Earthquake analysis map setup failed:', err)
      }

      suppressStyleFlyRef.current = false
    }

    const startMap = () => {
      if (map) return
      if (container.clientWidth < 50 || container.clientHeight < 50) return

      map = new maplibregl.Map({
        container,
        style: COMMAND_MAP_STYLE,
        center: [-98.5, 39.8],
        zoom: 4,
        attributionControl: false,
      })
      mapRef.current = map

      const cornerControls = new MapCornerControls({
        maxWidth: 80,
        unit: 'imperial',
        faultLines: {
          onToggle: () => onFaultLinesToggleRef.current(),
        },
      })
      cornerControlsRef.current = cornerControls
      map.addControl(cornerControls, 'bottom-left')

      map.on('error', e => {
        console.error('Earthquake analysis map error:', e.error)
      })

      map.on('load', onMapLoad)
      map.on('style.load', () => {
        if (!map.getSource('eq-events')) {
          bindAnalysisLayersRef.current()
        } else {
          scheduleSyncMapDataRef.current()
        }
        scheduleResize()
      })
    }

    ro = new ResizeObserver(() => {
      startMap()
      scheduleResize()
      if (map?.isStyleLoaded() && !map.getSource('eq-events')) {
        bindAnalysisLayersRef.current()
      }
    })
    ro.observe(container)
    startMap()

    return () => {
      ro.disconnect()
      viewportKeyRef.current = null
      prevCenterRef.current = null
      lastFlownRecenterKeyRef.current = -1
      cornerControlsRef.current = null
      map?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    cornerControlsRef.current?.setFaultLinesActive(showFaultLines)
    if (!showFaultLines) setFaultHoverTip(null)
  }, [showFaultLines, mapReady])

  useEffect(() => {
    if (!mapReady) return undefined
    const map = mapRef.current
    if (!map) return undefined
    const id = requestAnimationFrame(() => map.resize())
    return () => cancelAnimationFrame(id)
  }, [layoutRevision, mapReady])

  useEffect(() => {
    if (!mapReady) return undefined

    const map = mapRef.current
    if (!map?.isStyleLoaded()) return undefined

    syncFaultLineSource(map)
    setFaultLinesVisibility(map, showFaultLines)

    return undefined
  }, [showFaultLines, mapReady])

  useEffect(() => {
    if (!mapReady || recenterKey === 0) return undefined

    const map = mapRef.current
    if (!map) return undefined

    if (lastFlownRecenterKeyRef.current === recenterKey) return undefined

    const attemptFly = () => {
      const params = flyParamsRef.current
      if (!params.center || !map.isStyleLoaded()) return false

      const fromCenter = prevCenterRef.current
      const flew = flyToAnalysisView(map, {
        center: params.center,
        maxRadiusMiles: params.maxRadiusMiles,
        fromCenter,
        animate: true,
        global: params.globalAnalysis,
        national: params.nationalAnalysis,
        countryOverview: params.countryOverviewAnalysis,
        countryBbox: params.countryBbox,
        eventList: params.events,
      })
      if (!flew) return false

      lastFlownRecenterKeyRef.current = recenterKey
      prevCenterRef.current = params.center
      viewportKeyRef.current = params.globalAnalysis
        ? `global-${params.events.length}|r${recenterKey}`
        : viewportKey(params.center, params.maxRadiusMiles, recenterKey)
      return true
    }

    if (attemptFly()) return undefined

    const onReady = () => {
      if (attemptFly()) map.off('idle', onReady)
    }
    map.on('idle', onReady)
    return () => map.off('idle', onReady)
  }, [mapReady, recenterKey, flyToAnalysisView])

  useEffect(() => {
    if (!mapReady || !center) return undefined

    const map = mapRef.current
    if (!map) return undefined

    const key = globalAnalysis
      ? `global-${events.length}|r${recenterKey}`
      : viewportKey(center, maxRadiusMiles, recenterKey)

    const runFly = () => {
      if (!map.isStyleLoaded() || !center) return false
      if (viewportKeyRef.current === key) return true

      const fromCenter = prevCenterRef.current
      const isFollowUp = viewportKeyRef.current != null

      viewportKeyRef.current = key
      prevCenterRef.current = center

      flyToAnalysisView(map, {
        center,
        maxRadiusMiles,
        fromCenter: isFollowUp ? fromCenter : null,
        animate: true,
        global: globalAnalysis,
        national: nationalAnalysis,
        countryOverview: countryOverviewAnalysis,
        countryBbox,
        eventList: events,
      })
      return true
    }

    if (runFly()) return undefined

    const onReady = () => {
      if (runFly()) map.off('idle', onReady)
    }
    map.on('idle', onReady)
    return () => map.off('idle', onReady)
  }, [
    mapReady,
    center?.lat,
    center?.lng,
    maxRadiusMiles,
    globalAnalysis,
    nationalAnalysis,
    countryOverviewAnalysis,
    countryBbox,
    events.length,
    recenterKey,
    flyToAnalysisView,
  ])

  useEffect(() => {
    if (!mapReady) return undefined
    scheduleSyncMapDataRef.current()
    return undefined
  }, [mapReady, events, eventGeoJSON, radiusGeoJSON, centerGeoJSON, yearPresetLabel])

  useEffect(() => {
    if (!mapReady) return undefined

    const map = mapRef.current
    if (!map) return undefined

    const onIdle = () => scheduleSyncMapDataRef.current()
    map.on('idle', onIdle)
    return () => map.off('idle', onIdle)
  }, [mapReady, events])

  const mapSummaryLine = globalAnalysis
    ? `Worldwide catalog · ${yearPresetLabel || '-'} · ${events.length} pts across all regions`
    : nationalAnalysis
      ? `National US catalog · ${yearPresetLabel || '-'} · ${events.length} pts`
      : countryOverviewAnalysis
        ? `National catalog · ${yearPresetLabel || '-'} · ${events.length} pts`
        : `${yearPresetLabel || '-'} window · ${maxRadiusMiles} mi · ${events.length} pts`

  return (
    <div className="relative flex h-full min-h-[340px] w-full flex-col">
      <div className="command-map-host relative min-h-[340px] flex-1 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#050505]">
        <div ref={mapContainerRef} className="absolute inset-0 z-0" />
        {!mapReady ? (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-mono text-[10px] text-ink-faint">
            Loading map…
          </p>
        ) : null}

        {faultHoverTip && showFaultLines ? (
          <div
            className="map-point-tooltip map-fault-tooltip pointer-events-none"
            style={{
              left: faultHoverTip.x,
              top: faultHoverTip.y,
              transform: 'translate(-50%, calc(-100% - 10px))',
            }}
            role="tooltip"
          >
            <span className="map-point-tooltip__meta">
              <span className="map-point-tooltip__dot map-point-tooltip__dot--critical" aria-hidden />
              {faultHoverTip.referenceSource}
            </span>
            <span className="map-point-tooltip__title">{faultHoverTip.displayName}</span>
            <span className="map-fault-tooltip__hint">Click for official source</span>
          </div>
        ) : null}

        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(100%-1.5rem,280px)] rounded-lg border border-[#444] bg-[#0a0a0a] px-3 py-2 shadow-lg">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#a3a3a3]">Analysis center</p>
          {label ? (
            <p className="mt-1 break-words font-mono text-[11px] font-medium leading-snug text-white">{label}</p>
          ) : null}
          <p className="mt-1 font-mono text-[9px] leading-snug text-[#a3a3a3]">
            {globalAnalysis
              ? `${yearPresetLabel || '-'} · worldwide`
              : nationalAnalysis
                ? `${yearPresetLabel || '-'} · national US`
                : countryOverviewAnalysis
                  ? `${yearPresetLabel || '-'} · national`
                  : `${yearPresetLabel || '-'} · ${maxRadiusMiles} mi`}
          </p>
        </div>
      </div>

      <p className="mt-2 text-center font-mono text-[9px] leading-relaxed text-ink-faint">{mapSummaryLine}</p>
    </div>
  )
}
