/** Shared basemap styles for MapLibre, used by analysis map and other views. */

/** Same basemap as Public Data Command (`CommandMap`). */
export const COMMAND_MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export const SATELLITE_STYLE = {
  version: 8,
  sources: {
    esriSatellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    {
      id: 'esriSatellite',
      type: 'raster',
      source: 'esriSatellite',
    },
  ],
}

const TERRAIN_TILES = 'https://demotiles.maplibre.org/terrain-tiles/tiles.json'
export const ANALYSIS_TERRAIN_SOURCE_ID = 'analysis-terrain-dem'

export const DEFAULT_TOPOGRAPHY_MODE = {
  id: 'road',
}

/** Single satellite toggle, preview + imagery style when active. */
export const SATELLITE_TOPOGRAPHY_MODE = {
  id: 'satellite',
  label: 'Satellite',
  insideStyle: SATELLITE_STYLE,
  previewBackground:
    'radial-gradient(circle at 35% 40%, #6b8f4e 0%, #4a6b35 28%, transparent 42%), radial-gradient(circle at 68% 55%, #8a7350 0%, #5c4a32 35%, transparent 50%), linear-gradient(160deg, #3d5c34 0%, #2a4024 100%)',
}

const LEGACY_TOPOGRAPHY_IDS = {
  dark: 'road',
  gps: 'road',
  light: 'road',
  topo: 'road',
  '3d': 'road',
}

export function findTopographyMode(id) {
  const normalized = LEGACY_TOPOGRAPHY_IDS[id] ?? id
  return normalized === 'satellite' ? SATELLITE_TOPOGRAPHY_MODE : DEFAULT_TOPOGRAPHY_MODE
}

/** Full MapLibre style for analysis map (not overlay). */
export function getAnalysisBasemapStyle(modeId) {
  return modeId === 'satellite' ? SATELLITE_STYLE : COMMAND_MAP_STYLE
}

/** Full basemap swap, road Carto vs Esri satellite style; resolves after style + idle. */
export async function swapAnalysisBasemap(map, modeId, { shouldContinue = () => true } = {}) {
  if (!map || !shouldContinue()) return false

  const targetStyle = getAnalysisBasemapStyle(modeId)

  return new Promise(resolve => {
    let settled = false

    const finish = async ok => {
      if (settled) return
      settled = true
      map.off('style.load', onStyleLoad)
      map.off('error', onError)
      if (!ok || !shouldContinue()) {
        resolve(false)
        return
      }
      const idleOk = await waitForMapIdle(map, shouldContinue)
      resolve(Boolean(idleOk))
    }

    const onStyleLoad = () => {
      void finish(true)
    }
    const onError = () => {
      void finish(false)
    }

    map.once('style.load', onStyleLoad)
    map.once('error', onError)
    try {
      map.setStyle(targetStyle)
    } catch {
      void finish(false)
    }
  })
}

export const ANALYSIS_SATELLITE_SOURCE_ID = 'analysis-satellite-imagery'
export const ANALYSIS_SATELLITE_LAYER_ID = 'analysis-satellite-imagery-layer'

const ESRI_IMAGERY_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

const SATELLITE_LAYER_ANCHORS = [
  'analysis-radius-unit-fill',
  'analysis-radius-sweet-fill',
  'eq-heatmap',
]

/** First analysis overlay to insert satellite raster beneath. */
export function resolveAnalysisSatelliteInsertBefore(map, preferredBeforeLayerId) {
  if (preferredBeforeLayerId && map.getLayer(preferredBeforeLayerId)) {
    return preferredBeforeLayerId
  }
  for (const id of SATELLITE_LAYER_ANCHORS) {
    if (map.getLayer(id)) return id
  }
  const styleLayers = map.getStyle()?.layers ?? []
  const firstSymbol = styleLayers.find(l => l.type !== 'background')?.id
  return firstSymbol ?? styleLayers[0]?.id
}

/** Add satellite raster under analysis overlays (idempotent). */
export function ensureAnalysisSatelliteImagery(map, { beforeLayerId } = {}) {
  if (!map?.isStyleLoaded?.()) return false

  if (!map.getSource(ANALYSIS_SATELLITE_SOURCE_ID)) {
    map.addSource(ANALYSIS_SATELLITE_SOURCE_ID, {
      type: 'raster',
      tiles: [ESRI_IMAGERY_TILES],
      tileSize: 256,
      maxzoom: 19,
    })
  }

  const insertBefore = resolveAnalysisSatelliteInsertBefore(map, beforeLayerId)

  if (!map.getLayer(ANALYSIS_SATELLITE_LAYER_ID)) {
    if (!insertBefore) return false
    map.addLayer(
      {
        id: ANALYSIS_SATELLITE_LAYER_ID,
        type: 'raster',
        source: ANALYSIS_SATELLITE_SOURCE_ID,
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0 },
      },
      insertBefore,
    )
    return true
  }

  repositionAnalysisSatelliteLayer(map, { beforeLayerId })
  return true
}

/** Keep satellite raster directly under analysis overlays after layer rebuilds. */
export function repositionAnalysisSatelliteLayer(map, { beforeLayerId } = {}) {
  if (!map?.getLayer(ANALYSIS_SATELLITE_LAYER_ID)) return

  const insertBefore = resolveAnalysisSatelliteInsertBefore(map, beforeLayerId)
  if (!insertBefore || insertBefore === ANALYSIS_SATELLITE_LAYER_ID) return

  try {
    map.moveLayer(ANALYSIS_SATELLITE_LAYER_ID, insertBefore)
  } catch {
    /* already in place */
  }
}

const SATELLITE_FADE_MS = 180

function fadeRasterOpacity(map, layerId, from, to, durationMs, shouldContinue) {
  const start = performance.now()

  return new Promise(resolve => {
    const tick = now => {
      if (!shouldContinue()) {
        resolve(false)
        return
      }
      const t = Math.min(1, (now - start) / durationMs)
      map.setPaintProperty(layerId, 'raster-opacity', from + (to - from) * t)
      if (t < 1) {
        requestAnimationFrame(tick)
        return
      }
      map.triggerRepaint()
      resolve(true)
    }
    requestAnimationFrame(tick)
  })
}

/** Wait for tiles to settle after enabling imagery (cancellable). */
export function waitForMapIdle(map, shouldContinue, timeoutMs = 2200) {
  return new Promise(resolve => {
    if (!map?.isStyleLoaded?.()) {
      resolve(false)
      return
    }
    if (!shouldContinue()) {
      resolve(false)
      return
    }

    let settled = false
    const finish = ok => {
      if (settled) return
      settled = true
      map.off('idle', onIdle)
      clearTimeout(timer)
      resolve(ok && shouldContinue())
    }

    const onIdle = () => finish(true)
    const timer = setTimeout(() => finish(shouldContinue()), timeoutMs)
    map.once('idle', onIdle)
  })
}

/** Toggle Esri imagery, road off is instant; satellite on can fade in. */
export async function setAnalysisSatelliteImagery(
  map,
  enabled,
  { beforeLayerId, animate = true, shouldContinue = () => true } = {},
) {
  if (!map?.isStyleLoaded?.()) return false

  if (!ensureAnalysisSatelliteImagery(map, { beforeLayerId })) return false
  repositionAnalysisSatelliteLayer(map, { beforeLayerId })

  if (!map.getLayer(ANALYSIS_SATELLITE_LAYER_ID)) {
    console.warn('Analysis satellite layer missing after ensure')
    return false
  }

  try {
    if (!enabled) {
      map.setLayoutProperty(ANALYSIS_SATELLITE_LAYER_ID, 'visibility', 'none')
      map.setPaintProperty(ANALYSIS_SATELLITE_LAYER_ID, 'raster-opacity', 0)
      map.triggerRepaint()
      return shouldContinue()
    }

    map.setLayoutProperty(ANALYSIS_SATELLITE_LAYER_ID, 'visibility', 'visible')

    if (animate) {
      map.setPaintProperty(ANALYSIS_SATELLITE_LAYER_ID, 'raster-opacity', 0)
      const faded = await fadeRasterOpacity(
        map,
        ANALYSIS_SATELLITE_LAYER_ID,
        0,
        1,
        SATELLITE_FADE_MS,
        shouldContinue,
      )
      return faded && shouldContinue()
    }

    map.setPaintProperty(ANALYSIS_SATELLITE_LAYER_ID, 'raster-opacity', 1)
    map.triggerRepaint()
    return shouldContinue()
  } catch (err) {
    console.warn('Satellite imagery toggle failed:', err)
    return false
  }
}

/** Camera + optional terrain. Base map passes enableTerrain: false for 3D (terrain only inside overlay). */
export function applyTopographyEnvironment(map, mode, { enableTerrain = true } = {}) {
  if (!map || !mode || !map.isStyleLoaded?.()) return

  if (enableTerrain && mode.terrain) {
    if (!map.getSource(ANALYSIS_TERRAIN_SOURCE_ID)) {
      map.addSource(ANALYSIS_TERRAIN_SOURCE_ID, {
        type: 'raster-dem',
        url: TERRAIN_TILES,
        tileSize: 256,
      })
    }
    map.setTerrain({ source: ANALYSIS_TERRAIN_SOURCE_ID, exaggeration: mode.terrainExaggeration ?? 1.35 })
  } else {
    map.setTerrain(null)
  }

  if (mode.terrain) {
    map.setPitch(mode.pitch ?? 55)
    if (mode.bearing != null) map.setBearing(mode.bearing)
  } else {
    map.setPitch(0)
    map.setBearing(0)
  }
}
