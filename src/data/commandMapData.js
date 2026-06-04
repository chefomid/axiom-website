export const RADIUS_OPTIONS = [25, 50, 75, 100, 150, 200, 250]

export const ANALYTICS_RADIUS_BREAKPOINTS = [25, 50, 75, 100, 150, 200, 250]

/** Continental US national analysis — wider bands from geographic center. */
export const NATIONAL_US_MAX_RADIUS_MILES = 1600
export const NATIONAL_US_RADIUS_BREAKPOINTS = [100, 250, 500, 750, 1000, 1250, 1600]
export const NATIONAL_US_RADIUS_OPTIONS = [500, 750, 1000, 1250, 1600]

export const ANALYTICS_YEAR_PRESETS = [
  { id: '1y', label: '1Y', years: 1 },
  { id: '5y', label: '5Y', years: 5 },
  { id: '10y', label: '10Y', years: 10 },
  { id: '30y', label: '30Y', years: 30 },
]

export const SCOPE_MODES = [
  { id: 'local', label: 'Local' },
  { id: 'national', label: 'National' },
  { id: 'global', label: 'Global' },
]

/** Live public-sector feeds on Public Data Command */
export const DATA_SOURCES = [
  { id: 'usgs', label: 'USGS', logo: '/data-sources/usgs.svg', defaultActive: true },
  { id: 'nws', label: 'NWS', logo: '/data-sources/nws.svg', defaultActive: true },
  { id: 'fema', label: 'FEMA', logo: '/data-sources/fema.svg', defaultActive: true },
  { id: 'nasa', label: 'NASA', logo: '/data-sources/nasa.svg', defaultActive: true },
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

/** Bounding boxes [minLon, minLat, maxLon, maxLat] for address search + USGS seismic analysis */
export const SEISMIC_COUNTRY_BBOX = {
  US: [-125.0, 24.5, -66.9, 49.5],
  CA: [-141.0, 41.7, -52.6, 83.1],
  MX: [-118.4, 14.5, -86.7, 32.7],
  GB: [-8.6, 49.9, 1.8, 60.9],
  DE: [5.9, 47.3, 15.0, 55.1],
  AU: [113.3, -43.6, 153.6, -10.7],
  JP: [129.0, 30.0, 146.0, 45.5],
}

/** Worldwide seismic analysis — full USGS catalog, no regional filter */
export const GLOBAL_ANALYSIS_COUNTRY = {
  id: 'GLOBAL',
  label: 'Global',
  center: [-20, 30],
  zoom: 1.8,
  bbox: null,
  addressPlaceholder: 'Select a country for address search',
}

/** Countries with verified USGS catalog coverage for seismic analytics (Step 1 picker). */
export const SEISMIC_ANALYTICS_COUNTRY_IDS = ['US', 'CA', 'MX', 'JP', 'AU']

/** Countries with USGS catalog coverage used in Seismic Analysis location picker */
export const SEISMIC_ANALYSIS_COUNTRIES = [
  GLOBAL_ANALYSIS_COUNTRY,
  ...COUNTRIES.filter(country => SEISMIC_ANALYTICS_COUNTRY_IDS.includes(country.id)).map(country => ({
  ...country,
  bbox: SEISMIC_COUNTRY_BBOX[country.id],
  addressPlaceholder:
    country.id === 'US'
      ? '123 Main St, Portland, OR'
      : country.id === 'CA'
        ? '100 Queen St W, Toronto ON'
        : country.id === 'MX'
          ? 'Av. Paseo de la Reforma 222, CDMX'
          : country.id === 'GB'
            ? '10 Downing St, London'
            : country.id === 'DE'
              ? 'Unter den Linden 1, Berlin'
              : country.id === 'AU'
                ? '1 Macquarie St, Sydney NSW'
                : '1 Chiyoda, Tokyo',
  })),
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

/** USGS minimum magnitude presets — dot colors match Command Map earthquake palette */
export const EARTHQUAKE_MAGNITUDE_OPTIONS = [
  {
    value: 2.5,
    label: 'All',
    labelClassName: 'font-semibold',
    description: 'All magnitudes M2.5+ (includes M3+, M4+, M5+, M6+)',
    color: SEVERITY_HEX.stable,
  },
  { value: 3, label: 'M3+', description: 'Felt regionally', color: SEVERITY_HEX.live },
  { value: 4, label: 'M4+', description: 'Light damage possible', color: LAYER_COLORS.earthquake },
  { value: 5, label: 'M5+', description: 'Moderate', color: SEVERITY_HEX.watch },
  { value: 6, label: 'M6+', description: 'Strong', color: SEVERITY_HEX.critical },
]

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
  'Live USGS, NWS, FEMA, and NASA hazard data.'
