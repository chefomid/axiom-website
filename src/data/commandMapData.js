export const RADIUS_OPTIONS = [25, 50, 75, 100, 250]

export const SCOPE_MODES = [
  { id: 'local', label: 'Local' },
  { id: 'national', label: 'National' },
  { id: 'global', label: 'Global' },
]

/** USGS minimum magnitude presets (last 30 days) */
export const EARTHQUAKE_MAGNITUDE_OPTIONS = [
  { value: 2.5, label: 'All', description: 'M2.5 and above' },
  { value: 3, label: 'M3+', description: 'Felt regionally' },
  { value: 4, label: 'M4+', description: 'Light damage possible' },
  { value: 5, label: 'M5+', description: 'Moderate' },
  { value: 6, label: 'M6+', description: 'Strong' },
]

/** Live public-sector feeds on Public Data Command */
export const DATA_SOURCES = [
  { id: 'usgs', label: 'USGS', defaultActive: true },
  { id: 'nws', label: 'NWS', defaultActive: true },
  { id: 'fema', label: 'FEMA', defaultActive: true },
  { id: 'nasa', label: 'NASA', defaultActive: true },
]

export const COUNTRIES = [
  { id: 'US', label: 'United States', center: [-98.5, 39.8], zoom: 3.6 },
  { id: 'CA', label: 'Canada', center: [-96.0, 56.0], zoom: 3.2 },
  { id: 'MX', label: 'Mexico', center: [-102.0, 23.6], zoom: 4.2 },
  { id: 'GB', label: 'United Kingdom', center: [-2.5, 54.5], zoom: 5.0 },
  { id: 'DE', label: 'Germany', center: [10.4, 51.1], zoom: 5.2 },
  { id: 'AU', label: 'Australia', center: [133.8, -25.3], zoom: 3.8 },
  { id: 'JP', label: 'Japan', center: [138.0, 36.2], zoom: 4.8 },
]

/** Map + UI accent hex per risk layer (matches CommandMap zone/point palette) */
export const LAYER_COLORS = {
  earthquake: '#ff9348',
  weather: '#f0d030',
  wildfire: '#e05252',
  flood: '#4a9eff',
}

export const RISK_LAYERS = [
  {
    id: 'earthquake',
    label: 'Seismic Activity',
    shortLabel: 'Earthquake',
    sources: 'USGS',
    color: LAYER_COLORS.earthquake,
    defaultActive: true,
  },
  {
    id: 'weather',
    label: 'Weather Alerts',
    shortLabel: 'Weather',
    sources: 'NWS',
    color: LAYER_COLORS.weather,
    defaultActive: true,
  },
  {
    id: 'wildfire',
    label: 'Wildfire Hotspots',
    shortLabel: 'Wildfire',
    sources: 'NASA FIRMS',
    color: LAYER_COLORS.wildfire,
    defaultActive: true,
  },
  {
    id: 'flood',
    label: 'Flood Hazard',
    shortLabel: 'Flood',
    sources: 'FEMA NFHL',
    color: LAYER_COLORS.flood,
    defaultActive: true,
  },
]

/** Map point colors — keep in sync with Intelligence Panel signal cards */
export const SEVERITY_HEX = {
  stable: '#3dd68c',
  live: '#4a9eff',
  watch: '#e8a838',
  critical: '#e05252',
}

export const SEVERITY = {
  stable: { label: 'Stable', color: 'command-stable', hex: SEVERITY_HEX.stable },
  live: { label: 'Live', color: 'command-live', hex: SEVERITY_HEX.live },
  watch: { label: 'Watch', color: 'command-watch', hex: SEVERITY_HEX.watch },
  critical: { label: 'Critical', color: 'command-critical', hex: SEVERITY_HEX.critical },
}

export const LAYER_BY_ID = Object.fromEntries(RISK_LAYERS.map(layer => [layer.id, layer]))

/** No static map markers — all layers use live APIs */
export const RISK_MARKERS = []

export const RISK_SIGNALS = []

export const TELEMETRY_TEMPLATES = []

/** One-line description for Impact Map public hazard feeds (Intelligence Panel footer). */
export const PUBLIC_HAZARD_TAGLINE =
  'Live USGS, NWS, FEMA, and NASA hazard data on one map.'
