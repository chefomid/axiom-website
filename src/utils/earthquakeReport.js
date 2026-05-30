import { computeMagnitudeDistribution, computeReturnPeriods } from './earthquakeModeling'
import { NATIONAL_US_MAX_RADIUS_MILES, SEISMIC_ANALYSIS_COUNTRIES } from '../data/commandMapData'
import { countryCenterLocation, globalCenterLocation } from '../services/geocode'

export const REPORT_FOCUS_OPTIONS = [
  {
    id: 'country',
    label: 'Country overview',
    description: 'National or regional catalog from the country center.',
  },
  {
    id: 'current-location',
    label: 'Current location',
    description: 'Your device or map position within the selected country.',
  },
  {
    id: 'address',
    label: 'Street address',
    description: 'Search for a specific address to analyze nearby activity.',
  },
  {
    id: 'global',
    label: 'Global',
    description: 'Worldwide USGS catalog for the selected timeline.',
  },
]

export const REPORT_DEPTH_PRESETS = [
  {
    id: 'quick',
    label: 'Quick summary',
    description: 'Headline, key metrics, and a plain-language overview.',
    sectionIds: [],
    includeCharts: false,
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Summary, charts, activity trends, and magnitude mix.',
    sectionIds: ['temporal-activity', 'magnitude-distribution'],
    includeCharts: true,
  },
  {
    id: 'comprehensive',
    label: 'Comprehensive',
    description: 'Full analysis with charts, recurrence, depth, and nearest fault.',
    sectionIds: [
      'temporal-activity',
      'return-periods',
      'magnitude-distribution',
      'depth-breakdown',
      'nearest-fault',
    ],
    includeCharts: true,
  },
]

/** @deprecated use focusId */
export const REPORT_SCOPE_LABELS = {
  global: 'Global',
  country: 'Country / region',
  location: 'Specific location',
}

const LOCATION_SECTION_IDS = new Set([
  'return-periods',
  'depth-breakdown',
  'nearest-fault',
])

const GLOBAL_SECTION_IDS = new Set(['magnitude-distribution'])

export function resolveReportScope({ globalAnalysis, countryOverview, focusId }) {
  if (focusId === 'global' || globalAnalysis) return 'global'
  if (focusId === 'country' || countryOverview) return 'country'
  return 'location'
}

export function sectionsForScope(scope) {
  if (scope === 'global') {
    return ['magnitude-distribution']
  }
  return [
    'temporal-activity',
    'return-periods',
    'magnitude-distribution',
    'depth-breakdown',
    'nearest-fault',
  ]
}

export function isSectionAvailable(sectionId, { scope, hasTemporalAnalytics }) {
  if (scope === 'global') return GLOBAL_SECTION_IDS.has(sectionId)
  if (sectionId === 'temporal-activity') return hasTemporalAnalytics
  if (LOCATION_SECTION_IDS.has(sectionId)) return scope !== 'global'
  return true
}

export function resolveReportSections(depthId, { scope, hasTemporalAnalytics }) {
  const preset = REPORT_DEPTH_PRESETS.find(p => p.id === depthId) ?? REPORT_DEPTH_PRESETS[1]
  const allowed = new Set(sectionsForScope(scope))
  return preset.sectionIds.filter(
    id => allowed.has(id) && isSectionAvailable(id, { scope, hasTemporalAnalytics }),
  )
}

/**
 * Resolve center, radius, and analysis flags for a report focus selection.
 * @param {{
 *   focusId: string,
 *   countryId: string,
 *   countries: Array<{ id: string, label: string, center: number[], bbox?: number[] }>,
 *   addressCenter?: { lat: number, lng: number, label?: string } | null,
 *   currentLocationCoords?: { lat: number, lng: number } | null,
 *   radiusMiles?: number,
 * }} params
 */
export function resolveReportFocusConfig({
  focusId,
  countryId,
  countries,
  addressCenter = null,
  currentLocationCoords = null,
  radiusMiles = 250,
}) {
  const country = countries.find(c => c.id === countryId) ?? countries[0]

  if (focusId === 'global') {
    return {
      focusId: 'global',
      analysisCountryId: 'GLOBAL',
      centerOverride: globalCenterLocation(),
      maxRadiusMiles: radiusMiles,
      globalAnalysis: true,
      countryOverview: false,
    }
  }

  if (focusId === 'country') {
    if (!country?.id || country.id === 'GLOBAL') {
      throw new Error('Select a country for country overview.')
    }
    return {
      focusId: 'country',
      analysisCountryId: country.id,
      centerOverride: countryCenterLocation(country),
      maxRadiusMiles: radiusMiles ?? NATIONAL_US_MAX_RADIUS_MILES,
      globalAnalysis: false,
      countryOverview: true,
    }
  }

  if (focusId === 'current-location') {
    if (!currentLocationCoords) {
      throw new Error('Current location is required.')
    }
    const { lat, lng } = currentLocationCoords
    return {
      focusId: 'current-location',
      analysisCountryId: detectCountryIdForCoords(lat, lng, countries.filter(c => c.id !== 'GLOBAL')),
      centerOverride: {
        lat,
        lng,
        label: `Current location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      },
      maxRadiusMiles: radiusMiles,
      globalAnalysis: false,
      countryOverview: false,
    }
  }

  if (focusId === 'address') {
    if (!country?.id || country.id === 'GLOBAL') {
      throw new Error('Select a country to search addresses in.')
    }
    if (!addressCenter?.lat || !addressCenter?.lng) {
      throw new Error('Select an address from search results.')
    }
    return {
      focusId: 'address',
      analysisCountryId: country.id,
      centerOverride: {
        lat: addressCenter.lat,
        lng: addressCenter.lng,
        label: addressCenter.label ?? `${addressCenter.lat.toFixed(4)}, ${addressCenter.lng.toFixed(4)}`,
      },
      maxRadiusMiles: radiusMiles,
      globalAnalysis: false,
      countryOverview: false,
    }
  }

  throw new Error('Unknown report focus.')
}

export function focusOptionsForCountry(countryId) {
  if (countryId === 'GLOBAL') {
    return REPORT_FOCUS_OPTIONS.filter(opt => opt.id === 'global')
  }
  return REPORT_FOCUS_OPTIONS.filter(opt => opt.id !== 'global')
}

export const REPORT_ABOUT_OPTIONS = [
  {
    id: 'global',
    label: 'Global',
    description: 'Worldwide USGS catalog for the selected timeline and magnitude.',
  },
  {
    id: 'country',
    label: 'Country overview',
    description: 'National or regional catalog centered on the country.',
  },
  {
    id: 'current-location',
    label: 'Current location',
    description: 'Your device or map position — radius search from where you are.',
  },
  {
    id: 'address',
    label: 'Street address',
    description: 'Search for a specific address and analyze nearby activity.',
  },
]

export const SEISMIC_COUNTRIES_FOR_REPORT = SEISMIC_ANALYSIS_COUNTRIES.filter(c => c.id !== 'GLOBAL')

function inBbox(lat, lng, bbox) {
  if (!bbox || bbox.length !== 4) return true
  const [minLon, minLat, maxLon, maxLat] = bbox
  return lng >= minLon && lng <= maxLon && lat >= minLat && lat <= maxLat
}

/** Pick the best analysis country id for coordinates (USGS catalog scope). */
export function detectCountryIdForCoords(lat, lng, countries = SEISMIC_COUNTRIES_FOR_REPORT) {
  for (const country of countries) {
    if (inBbox(lat, lng, country.bbox)) return country.id
  }
  return 'US'
}
function formatYearsLabel(yearPreset) {
  const years = yearPreset?.years ?? 1
  if (years === 1) return '1 year'
  if (Number.isInteger(years)) return `${years} years`
  return yearPreset?.label ?? `${years} years`
}

function activityLevel(eventsPerYear, globalAnalysis) {
  const low = globalAnalysis ? 500 : 5
  const high = globalAnalysis ? 5000 : 25
  if (eventsPerYear < low) return { id: 'low', label: 'Low activity', tone: 'stable' }
  if (eventsPerYear < high) return { id: 'moderate', label: 'Moderate activity', tone: 'watch' }
  return { id: 'elevated', label: 'Elevated activity', tone: 'seismic' }
}

/**
 * @param {{
 *   scope: string,
 *   locationLabel: string,
 *   yearPreset: { years?: number, label?: string },
 *   minMagnitude: number,
 *   activeMaxRadiusMiles?: number,
 *   globalAnalysis?: boolean,
 *   summary?: { totalEvents?: number, maxEvent?: { mag?: number, dist?: number }, yearsInRange?: number },
 *   events?: Array<{ mag?: number }>,
 * }} params
 */
export function buildReportNarrative({
  scope,
  locationLabel,
  yearPreset,
  minMagnitude,
  activeMaxRadiusMiles,
  globalAnalysis = false,
  summary,
  events = [],
}) {
  const yearsText = formatYearsLabel(yearPreset)
  const total = summary?.totalEvents ?? 0
  const yearsInRange = summary?.yearsInRange ?? yearPreset?.years ?? 5
  const eventsPerYear = total / Math.max(yearsInRange, 1 / 365)
  const level = activityLevel(eventsPerYear, globalAnalysis)
  const magPhrase =
    minMagnitude <= 2.5 ? 'magnitude 2.5 and above' : `magnitude ${minMagnitude} and above`

  let headline
  if (globalAnalysis) {
    headline = `${total.toLocaleString()} earthquakes worldwide (${magPhrase}) over the last ${yearsText}.`
  } else if (scope === 'country') {
    headline = `${total.toLocaleString()} earthquakes recorded near ${locationLabel} within ${activeMaxRadiusMiles} mi over the last ${yearsText}.`
  } else {
    headline = `${total.toLocaleString()} earthquakes within ${activeMaxRadiusMiles} mi of ${locationLabel} over the last ${yearsText}.`
  }

  const maxMag = summary?.maxEvent?.mag
  const maxDist = summary?.maxEvent?.dist
  const distribution = computeMagnitudeDistribution(events, minMagnitude)
  const returns = computeReturnPeriods(events, yearsInRange, [5, 6])
  const m5 = returns.find(r => r.threshold === 5)

  const bullets = []
  if (maxMag != null) {
    bullets.push(
      globalAnalysis || maxDist == null
        ? `Strongest recorded event: M${maxMag.toFixed(1)}.`
        : `Strongest nearby event: M${maxMag.toFixed(1)}, about ${maxDist.toFixed(0)} miles away.`,
    )
  }
  if (distribution.dominant?.count > 0) {
    bullets.push(
      `Most common magnitudes: ${distribution.dominant.label} (${distribution.dominant.percent.toFixed(0)}% of events).`,
    )
  }
  if (!globalAnalysis && m5?.count > 0) {
    bullets.push(
      `About ${m5.ratePerYear.toFixed(1)} M5+ events per year in this search area (catalog average).`,
    )
  }
  bullets.push(`Activity level for this window: ${level.label.toLowerCase()}.`)

  let meaning
  if (globalAnalysis) {
    meaning =
      'This report summarizes worldwide earthquake catalog activity from the USGS. Counts reflect published historical records for your chosen timeline and magnitude filter — not live shaking or future forecasts.'
  } else if (scope === 'country') {
    meaning = `This report describes historical earthquake frequency around ${locationLabel} using USGS catalog data. It helps compare how often earthquakes of different sizes have been recorded nearby — useful context for regional hazard awareness.`
  } else {
    meaning = `This report summarizes earthquake activity near ${locationLabel}. The numbers come from the USGS historical catalog within your selected radius and time window. They describe past recorded events, not predictions of when the next earthquake will occur.`
  }

  return {
    headline,
    meaning,
    bullets: bullets.slice(0, 5),
    activityLevel: level,
    eventsPerYear,
    filterSummary: globalAnalysis
      ? `${yearsText} · ${magPhrase}`
      : `${yearsText} · ${activeMaxRadiusMiles} mi · ${magPhrase}`,
  }
}

export function formatReportDate(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function reportPdfFilename(locationLabel) {
  const slug = String(locationLabel ?? 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `seismic-report-${slug || 'export'}.pdf`
}

export function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () =>
        reject(
          new Error('Unable to access your location. Allow browser location access and try again.'),
        ),
      { enableHighAccuracy: true, timeout: 12000 },
    )
  })
}

/**
 * Resolve a report builder draft into a full report config (may request geolocation).
 * @param {object} draft
 * @param {{ mapUserLocation?: { lat: number, lng: number } | null }} [options]
 */
export async function buildReportConfigFromDraft(draft, { mapUserLocation = null } = {}) {
  let currentLocationCoords = null
  if (draft.aboutType === 'current-location') {
    currentLocationCoords = mapUserLocation ?? (await requestBrowserLocation())
  }

  const focusCountryId =
    draft.aboutType === 'country' || draft.aboutType === 'address' ? draft.countryId : undefined

  const focus = resolveReportFocusConfig({
    focusId: draft.aboutType,
    countryId: focusCountryId,
    countries: SEISMIC_COUNTRIES_FOR_REPORT,
    addressCenter: draft.aboutType === 'address' ? draft.addressCenter : null,
    currentLocationCoords,
    radiusMiles: draft.radiusMiles,
  })

  const scope = resolveReportScope({
    focusId: focus.focusId,
    globalAnalysis: focus.globalAnalysis,
    countryOverview: focus.countryOverview,
  })

  return {
    ...focus,
    depthId: draft.depthId,
    sectionIds: draft.sectionIds,
    includeCharts: draft.includeCharts,
    scope,
    yearPresetId: draft.yearPresetId,
    minMagnitude: draft.minMagnitude,
  }
}
