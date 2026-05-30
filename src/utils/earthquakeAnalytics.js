import { COUNTRIES, ANALYTICS_RADIUS_BREAKPOINTS } from '../data/commandMapData'
import { distanceMiles } from './geo'

export { ANALYTICS_RADIUS_BREAKPOINTS }

const GLOBAL_DEFAULT_CENTER = { lat: 39.8, lng: -98.5 }

export function isCountryOverview(analysisCountryId, centerOverride) {
  if (analysisCountryId === 'GLOBAL' || !centerOverride) return false
  return Boolean(centerOverride.label?.includes('(overview)'))
}

export function isNationalUsOverview(analysisCountryId, centerOverride) {
  return analysisCountryId === 'US' && isCountryOverview(analysisCountryId, centerOverride)
}

export function isGlobalOverview(analysisCountryId) {
  return analysisCountryId === 'GLOBAL'
}

/** True when analysis is anchored to an address or device/map location (not country overview). */
export function isSpecificAnalysisLocation(centerOverride, countryOverview) {
  if (countryOverview || !centerOverride) return false
  return !centerOverride.label?.includes('(overview)')
}

/** True when time-based cumulative / period charts can be computed for the active scope. */
export function supportsTemporalAnalytics(centerOverride, globalAnalysis) {
  return Boolean(centerOverride) && !globalAnalysis
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

function msAtYearsFromStart(startMs, yearsFromStart) {
  return startMs + yearsFromStart * MS_PER_YEAR
}

/** Monotonic year offsets from range start for cumulative / band charts. */
export function timeBreakpointsFromYears(yearsInRange) {
  const safeYears = Math.max(yearsInRange, 1 / 365)

  if (safeYears <= 1.1) {
    return [0.25, 0.5, 0.75, 1].map(fraction => fraction * safeYears)
  }

  if (safeYears <= 10.5) {
    const wholeYears = Math.max(1, Math.round(safeYears))
    return Array.from({ length: wholeYears }, (_, i) => i + 1)
  }

  const step = 5
  const count = Math.max(1, Math.ceil(safeYears / step))
  return Array.from({ length: count }, (_, i) => Math.min((i + 1) * step, safeYears))
}

function temporalBandLabel(startDate, endDate, yearsInRange) {
  if (yearsInRange <= 1.1) {
    const fmt = date =>
      date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    return `${fmt(startDate)}–${fmt(endDate)}`
  }

  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  return startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`
}

function formatCumulativeTimeLabel(date, yearsInRange) {
  if (yearsInRange <= 1.1) {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return String(date.getFullYear())
}

/** Non-overlapping time bands from monotonic year-offset breakpoints. */
export function temporalBandsFromBreakpoints(breakpoints, startDate, yearsInRange) {
  const startMs = startDate.getTime()

  return breakpoints.map((outerYears, i) => {
    const innerYears = i === 0 ? 0 : breakpoints[i - 1]
    const bandStart = new Date(i === 0 ? startMs : msAtYearsFromStart(startMs, innerYears))
    const bandEnd = new Date(msAtYearsFromStart(startMs, outerYears))
    return {
      inner: innerYears,
      outer: outerYears,
      label: temporalBandLabel(bandStart, bandEnd, yearsInRange),
      bandStart,
      bandEnd,
    }
  })
}

function eventsWithinRadius(events, center, maxRadiusMiles, startMs, endMs) {
  return events
    .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng) && Number.isFinite(e.time))
    .map(e => ({
      ...e,
      dist: distanceMiles(center, e),
    }))
    .filter(e => e.dist <= maxRadiusMiles && e.time >= startMs && e.time <= endMs)
}

/**
 * Resolve the anchor point for radius-based earthquake analytics.
 * @param {{ scope: string, userLocation?: { lat: number, lng: number }, countryId?: string }} config
 */
export function resolveAnalysisCenter({ scope, userLocation, countryId = 'US' }) {
  if (scope === 'local' && userLocation) {
    return {
      center: userLocation,
      scopeLabel: 'Local',
      locationLabel: `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`,
    }
  }

  if (scope === 'national') {
    const country = COUNTRIES.find(c => c.id === countryId)
    if (country) {
      return {
        center: { lat: country.center[1], lng: country.center[0] },
        scopeLabel: 'National',
        locationLabel: `${country.label} center`,
      }
    }
  }

  const us = COUNTRIES.find(c => c.id === 'US')
  return {
    center: GLOBAL_DEFAULT_CENTER,
    scopeLabel: 'Global',
    locationLabel: us ? `${us.label} center (default)` : 'Default center',
  }
}

/** Non-overlapping annular bands from monotonic radius breakpoints. */
export function annularBandsFromBreakpoints(breakpoints) {
  return breakpoints.map((outer, i) => ({
    inner: i === 0 ? 0 : breakpoints[i - 1],
    outer,
    label: i === 0 ? `0–${outer}` : `${breakpoints[i - 1]}–${outer}`,
  }))
}

function bandAreaSqMi(inner, outer) {
  return Math.PI * (outer ** 2 - inner ** 2)
}

/**
 * Compute cumulative and annular metrics from earthquake events.
 * @param {Array<{ lat: number, lng: number, mag?: number, time?: number }>} events
 * @param {{ lat: number, lng: number }} center
 * @param {number[]} breakpoints
 * @param {number} yearsInRange
 */
export function computeEarthquakeAnalytics(events, center, breakpoints, yearsInRange) {
  const maxRadius = breakpoints[breakpoints.length - 1]
  const safeYears = Math.max(yearsInRange, 1 / 365)

  const withDist = events
    .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng))
    .map(e => ({
      ...e,
      dist: distanceMiles(center, e),
    }))
    .filter(e => e.dist <= maxRadius)

  const cumulative = breakpoints.map((radius, i) => {
    const count = withDist.filter(e => e.dist <= radius).length
    const prevCount = i === 0 ? 0 : withDist.filter(e => e.dist <= breakpoints[i - 1]).length
    return {
      radius,
      count,
      ratePerYear: count / safeYears,
      marginal: count - prevCount,
    }
  })

  const annular = annularBandsFromBreakpoints(breakpoints).map(({ inner, outer, label }) => {
    const count = withDist.filter(e => e.dist > inner && e.dist <= outer).length
    const areaSqMi = bandAreaSqMi(inner, outer)
    const density = count / areaSqMi
    const densityPerYear = count / (safeYears * areaSqMi)
    return {
      inner,
      outer,
      label,
      count,
      areaSqMi,
      density,
      densityPerYear,
      densityPer1000SqMiPerYear: densityPerYear * 1000,
    }
  })

  const peakBand = annular.reduce(
    (best, band) =>
      band.densityPerYear > (best?.densityPerYear ?? Number.NEGATIVE_INFINITY) ? band : best,
    null,
  )

  const strongest = withDist.reduce(
    (best, e) => ((e.mag ?? 0) > (best?.mag ?? -Infinity) ? e : best),
    null,
  )

  return {
    summary: {
      totalEvents: withDist.length,
      peakDensityPer1000SqMiPerYear: peakBand?.densityPer1000SqMiPerYear ?? null,
      maxEvent: strongest
        ? {
            mag: strongest.mag,
            dist: strongest.dist,
          }
        : null,
      yearsInRange: safeYears,
    },
    cumulative,
    annular,
  }
}

/**
 * Compute cumulative and period metrics over time for events near a fixed location.
 * @param {Array<{ lat: number, lng: number, mag?: number, time?: number }>} events
 * @param {{ lat: number, lng: number }} center
 * @param {number} maxRadiusMiles
 * @param {Date} startDate
 * @param {Date} endDate
 */
export function computeTemporalEarthquakeAnalytics(events, center, maxRadiusMiles, startDate, endDate) {
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()
  const yearsInRange = Math.max((endMs - startMs) / MS_PER_YEAR, 1 / 365)
  const breakpoints = timeBreakpointsFromYears(yearsInRange)

  const scoped = eventsWithinRadius(events, center, maxRadiusMiles, startMs, endMs)

  const cumulative = breakpoints.map((yearsFromStart, i) => {
    const breakpointMs = msAtYearsFromStart(startMs, yearsFromStart)
    const count = scoped.filter(e => e.time <= breakpointMs).length
    const prevYears = i === 0 ? 0 : breakpoints[i - 1]
    const prevMs = i === 0 ? startMs : msAtYearsFromStart(startMs, prevYears)
    const prevCount = scoped.filter(e => e.time <= prevMs).length
    const elapsedYears = Math.max(yearsFromStart, 1 / 365)

    return {
      yearsFromStart,
      timeLabel: formatCumulativeTimeLabel(new Date(breakpointMs), yearsInRange),
      count,
      ratePerYear: count / elapsedYears,
      marginal: count - prevCount,
    }
  })

  const annular = temporalBandsFromBreakpoints(breakpoints, startDate, yearsInRange).map(
    ({ inner, outer, label, bandStart, bandEnd }, i) => {
      const innerMs = i === 0 ? startMs - 1 : bandStart.getTime()
      const count = scoped.filter(e => e.time > innerMs && e.time <= bandEnd.getTime()).length
      const bandYears = Math.max(outer - inner, 1 / 365)
      const densityPerYear = count / bandYears

      return {
        inner,
        outer,
        label,
        count,
        bandYears,
        densityPerYear,
        densityPer1000SqMiPerYear: densityPerYear,
        bandRatePerYear: densityPerYear,
      }
    },
  )

  const peakBand = annular.reduce(
    (best, band) =>
      band.densityPerYear > (best?.densityPerYear ?? Number.NEGATIVE_INFINITY) ? band : best,
    null,
  )

  const strongest = scoped.reduce(
    (best, e) => ((e.mag ?? 0) > (best?.mag ?? -Infinity) ? e : best),
    null,
  )

  return {
    summary: {
      totalEvents: scoped.length,
      peakDensityPer1000SqMiPerYear: peakBand?.densityPerYear ?? null,
      maxEvent: strongest
        ? {
            mag: strongest.mag,
            dist: strongest.dist,
          }
        : null,
      yearsInRange,
    },
    cumulative,
    annular,
  }
}

/**
 * @param {number} years
 * @returns {{ startDate: Date, endDate: Date, yearsInRange: number }}
 */
export function dateRangeForYears(years) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - years)
  const ms = endDate.getTime() - startDate.getTime()
  return {
    startDate,
    endDate,
    yearsInRange: ms / (365.25 * 24 * 60 * 60 * 1000),
  }
}

/**
 * Worldwide summary metrics — no radius bucketing.
 */
export function computeGlobalEarthquakeAnalytics(events, yearsInRange) {
  const safeYears = Math.max(yearsInRange, 1 / 365)
  const scoped = events.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng))
  const strongest = scoped.reduce(
    (best, e) => ((e.mag ?? 0) > (best?.mag ?? -Infinity) ? e : best),
    null,
  )

  return {
    summary: {
      totalEvents: scoped.length,
      peakDensityPer1000SqMiPerYear: null,
      maxEvent: strongest
        ? {
            mag: strongest.mag,
            dist: null,
          }
        : null,
      yearsInRange: safeYears,
    },
    cumulative: [],
    annular: [],
  }
}

/**
 * @param {{ totalEvents?: number }} summary
 * @param {{ years: number, label: string }} yearPreset
 * @param {number} minMagnitude
 */
export function assessSeismicDataQuality(
  summary,
  yearPreset,
  minMagnitude,
  { nationalUs = false, countryOverview = false, global = false, countryLabel = 'this region' } = {},
) {
  const total = summary?.totalEvents ?? 0
  const magLabel = minMagnitude >= 6 ? 'M6+' : minMagnitude >= 5 ? 'M5+' : minMagnitude >= 4 ? 'M4+' : minMagnitude >= 3 ? 'M3+' : 'M2.5+'
  const regionPhrase = global
    ? 'worldwide'
    : nationalUs
      ? 'in the United States'
      : countryOverview
        ? `in ${countryLabel}`
        : 'within 250 mi of this location'

  if (total === 0) {
    if (global) {
      return {
        level: 'none',
        message: `The ${yearPreset.label} global catalog did not load any ${magLabel} events. USGS publishes earthquakes worldwide — use Retry, try 5Y or 10Y, or select US / MX for a regional view.`,
      }
    }

    return {
      level: 'none',
      message: `USGS has no ${magLabel} earthquakes ${regionPhrase} over the last ${yearPreset.label}. Activity here may be below catalog thresholds, or the site may sit outside seismically active zones.`,
    }
  }

  if (total < 3) {
    return {
      level: 'sparse',
      message: `Only ${total} event${total === 1 ? '' : 's'} found in ${yearPreset.label} at ${magLabel}. Charts may not be meaningful — try a lower magnitude filter or a longer time range.`,
    }
  }

  return { level: 'ok', message: null }
}

const USGS_CATALOG_CAP = 20000

/**
 * Detect when time-period bars are likely equalized by per-bucket catalog caps.
 * @param {Array<{ count?: number }>} annular
 * @param {{ truncated?: boolean }} options
 */
export function assessTemporalPeriodQuality(annular, { truncated = false } = {}) {
  if (!annular?.length) {
    return { level: 'none', message: null }
  }

  const counts = annular.map(b => b.count ?? 0)
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const perBucketCap = Math.ceil(USGS_CATALOG_CAP / annular.length)
  const allNearCap = truncated && counts.every(c => c >= perBucketCap * 0.85)
  const allEqual = max > 0 && max - min <= Math.max(1, max * 0.05)

  if (allNearCap || (truncated && allEqual && max >= perBucketCap * 0.5)) {
    return {
      level: 'saturated',
      message:
        'Each time period hit the USGS sample cap, so bars can look equal. Try M4+ or a shorter timeline for meaningful period comparison.',
    }
  }

  if (allEqual && max > 0) {
    return {
      level: 'uniform',
      message: 'Activity was evenly spread across these periods for the current filters.',
    }
  }

  return { level: 'ok', message: null }
}
