/** Shared basemap styles for MapLibre — used by analysis map and other views. */

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

/** Single satellite toggle — preview + imagery style when active. */
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

export const ANALYSIS_SATELLITE_SOURCE_ID = 'analysis-satellite-imagery'
export const ANALYSIS_SATELLITE_LAYER_ID = 'analysis-satellite-imagery-layer'

const ESRI_IMAGERY_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

/** Add satellite raster under analysis overlays (idempotent). */
export function ensureAnalysisSatelliteImagery(map, { beforeLayerId } = {}) {
  if (!map?.isStyleLoaded?.()) return

  if (!map.getSource(ANALYSIS_SATELLITE_SOURCE_ID)) {
    map.addSource(ANALYSIS_SATELLITE_SOURCE_ID, {
      type: 'raster',
      tiles: [ESRI_IMAGERY_TILES],
      tileSize: 256,
      maxzoom: 19,
    })
  }

  if (!map.getLayer(ANALYSIS_SATELLITE_LAYER_ID)) {
    const beforeId =
      beforeLayerId && map.getLayer(beforeLayerId) ? beforeLayerId : map.getStyle().layers[0]?.id
    map.addLayer(
      {
        id: ANALYSIS_SATELLITE_LAYER_ID,
        type: 'raster',
        source: ANALYSIS_SATELLITE_SOURCE_ID,
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 1 },
      },
      beforeId,
    )
  }
}

/** Toggle Esri imagery — opacity/visibility only; dark basemap stays underneath. */
export function setAnalysisSatelliteImagery(map, enabled, { beforeLayerId } = {}) {
  if (!map?.isStyleLoaded?.()) return

  ensureAnalysisSatelliteImagery(map, { beforeLayerId })

  if (enabled) {
    map.setLayoutProperty(ANALYSIS_SATELLITE_LAYER_ID, 'visibility', 'visible')
    map.setPaintProperty(ANALYSIS_SATELLITE_LAYER_ID, 'raster-opacity', 1)
    return
  }

  map.setPaintProperty(ANALYSIS_SATELLITE_LAYER_ID, 'raster-opacity', 0)
  map.setLayoutProperty(ANALYSIS_SATELLITE_LAYER_ID, 'visibility', 'none')
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
