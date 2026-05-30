import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ANALYTICS_RADIUS_BREAKPOINTS,
  ANALYTICS_YEAR_PRESETS,
  NATIONAL_US_RADIUS_BREAKPOINTS,
  SEISMIC_ANALYSIS_COUNTRIES,
} from '../data/commandMapData'
import { fetchUsgsEarthquakeHistory } from '../services/usgsEarthquakes'
import {
  assessSeismicDataQuality,
  computeEarthquakeAnalytics,
  computeGlobalEarthquakeAnalytics,
  computeTemporalEarthquakeAnalytics,
  dateRangeForYears,
  isCountryOverview,
  isGlobalOverview,
  isNationalUsOverview,
  isSpecificAnalysisLocation,
  resolveAnalysisCenter,
  supportsTemporalAnalytics,
} from '../utils/earthquakeAnalytics'
import { getRiskCache, riskCacheKey, setRiskCache } from '../utils/riskCache'

const EMPTY_ANALYTICS = {
  summary: null,
  cumulative: [],
  annular: [],
}

/**
 * @param {{
 *   scope: string,
 *   userLocation?: { lat: number, lng: number },
 *   countryId?: string,
 *   analysisCountryId?: string,
 *   centerOverride?: { lat: number, lng: number, label?: string } | null,
 *   minMagnitude: number,
 *   yearPresetId?: string,
 *   maxRadiusMiles?: number,
 *   enabled: boolean,
 * }} options
 */
export default function useEarthquakeAnalytics({
  scope,
  userLocation,
  countryId,
  analysisCountryId = 'US',
  centerOverride = null,
  minMagnitude,
  yearPresetId = '5y',
  maxRadiusMiles = ANALYTICS_RADIUS_BREAKPOINTS[ANALYTICS_RADIUS_BREAKPOINTS.length - 1],
  enabled,
}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [truncated, setTruncated] = useState(false)
  const [requestUrl, setRequestUrl] = useState(null)
  const [fetchTick, setFetchTick] = useState(0)

  const nationalAnalysis = isNationalUsOverview(analysisCountryId, centerOverride)
  const countryOverview = isCountryOverview(analysisCountryId, centerOverride)
  const globalAnalysis = isGlobalOverview(analysisCountryId)

  const resolved = useMemo(() => {
    if (centerOverride) {
      const isOverview = centerOverride.label?.includes('(overview)')
      return {
        center: { lat: centerOverride.lat, lng: centerOverride.lng },
        scopeLabel: globalAnalysis ? 'Global' : nationalAnalysis ? 'National' : isOverview ? 'Country' : 'Address',
        locationLabel:
          centerOverride.label ??
          `${centerOverride.lat.toFixed(4)}, ${centerOverride.lng.toFixed(4)}`,
        nationalAnalysis,
        countryOverview,
        globalAnalysis,
      }
    }
    const base = resolveAnalysisCenter({ scope, userLocation, countryId })
    return { ...base, nationalAnalysis: scope === 'national' && countryId === 'US', globalAnalysis: false }
  }, [
    centerOverride?.lat,
    centerOverride?.lng,
    centerOverride?.label,
    scope,
    userLocation?.lat,
    userLocation?.lng,
    countryId,
    nationalAnalysis,
    countryOverview,
    globalAnalysis,
  ])

  const yearPreset = useMemo(
    () => ANALYTICS_YEAR_PRESETS.find(p => p.id === yearPresetId) ?? ANALYTICS_YEAR_PRESETS[1],
    [yearPresetId],
  )

  const dateRange = useMemo(
    () => dateRangeForYears(yearPreset.years),
    [yearPreset.years],
  )

  const historyRangeKey = `${dateRange.startDate.toISOString().slice(0, 10)}|${dateRange.endDate.toISOString().slice(0, 10)}`
  const centerLat = resolved.center?.lat
  const centerLng = resolved.center?.lng

  const activeBreakpoints = useMemo(() => {
    const breakpoints =
      nationalAnalysis || countryOverview ? NATIONAL_US_RADIUS_BREAKPOINTS : ANALYTICS_RADIUS_BREAKPOINTS
    return breakpoints.filter(b => b <= maxRadiusMiles)
  }, [nationalAnalysis, countryOverview, maxRadiusMiles])

  const refetch = useCallback(() => setFetchTick(t => t + 1), [])

  useEffect(() => {
    if (!enabled) {
      setEvents([])
      setError(null)
      setLoading(false)
      setTruncated(false)
      setRequestUrl(null)
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const { center } = resolved
    const { startDate, endDate } = dateRange

    if (!center?.lat || !center?.lng) {
      setLoading(false)
      return undefined
    }

    async function load() {
      setError(null)

      const cacheKey = riskCacheKey([
        'stratified-history-v4',
        globalAnalysis
          ? 'global-worldwide-v4'
          : countryOverview
            ? `national-bbox-${analysisCountryId}`
            : 'local',
        analysisCountryId,
        center.lat,
        center.lng,
        minMagnitude,
        maxRadiusMiles,
        yearPresetId,
        startDate.toISOString().slice(0, 10),
        endDate.toISOString().slice(0, 10),
      ])

      const cached = getRiskCache('usgs-history', cacheKey)
      if (cached) {
        if (cancelled) return
        setEvents(cached.events)
        setTruncated(cached.truncated)
        setRequestUrl(cached.requestUrl)
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const result = await fetchUsgsEarthquakeHistory(
          {
            center,
            maxRadiusMiles,
            minMagnitude,
            startDate,
            endDate,
            national: countryOverview,
            global: globalAnalysis,
            countryId: analysisCountryId,
          },
          { signal: controller.signal },
        )

        if (cancelled) return

        if (result.events.length > 0 || !globalAnalysis) {
          setRiskCache('usgs-history', cacheKey, result)
        }

        setEvents(result.events)
        setTruncated(result.truncated)
        setRequestUrl(result.requestUrl)
        if (globalAnalysis && result.events.length === 0) {
          setError('Global catalog returned no events. Check your connection and use Retry in the sidebar.')
        } else if (globalAnalysis && result.events.length > 0) {
          setError(null)
        }
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        setError(err.message ?? 'Failed to load earthquake history')
        setEvents([])
        setTruncated(false)
        setRequestUrl(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    enabled,
    centerLat,
    centerLng,
    centerOverride?.label,
    nationalAnalysis,
    countryOverview,
    globalAnalysis,
    analysisCountryId,
    minMagnitude,
    maxRadiusMiles,
    yearPresetId,
    historyRangeKey,
    fetchTick,
  ])

  const analytics = useMemo(() => {
    if (globalAnalysis) {
      if (!events.length) {
        if (loading || error) return EMPTY_ANALYTICS
        return computeGlobalEarthquakeAnalytics([], dateRange.yearsInRange)
      }
      return computeGlobalEarthquakeAnalytics(events, dateRange.yearsInRange)
    }

    if (!events.length) {
      if (loading || error) return EMPTY_ANALYTICS
      return computeEarthquakeAnalytics([], resolved.center, activeBreakpoints, dateRange.yearsInRange)
    }
    return computeEarthquakeAnalytics(
      events,
      resolved.center,
      activeBreakpoints,
      dateRange.yearsInRange,
    )
  }, [globalAnalysis, events, resolved.center, activeBreakpoints, dateRange.yearsInRange, loading, error])

  const canAnalyzeByTime = isSpecificAnalysisLocation(centerOverride, countryOverview)
  const hasTemporalAnalytics = supportsTemporalAnalytics(centerOverride, globalAnalysis)

  const temporalAnalytics = useMemo(() => {
    if (!hasTemporalAnalytics) return EMPTY_ANALYTICS
    const { startDate, endDate } = dateRange
    return computeTemporalEarthquakeAnalytics(
      events,
      resolved.center,
      maxRadiusMiles,
      startDate,
      endDate,
    )
  }, [hasTemporalAnalytics, events, resolved.center, maxRadiusMiles, dateRange])

  const dataQuality = useMemo(() => {
    const overviewCountryLabel =
      SEISMIC_ANALYSIS_COUNTRIES.find(c => c.id === analysisCountryId)?.label ?? 'this region'
    return assessSeismicDataQuality(analytics.summary, yearPreset, minMagnitude, {
      nationalUs: nationalAnalysis,
      countryOverview,
      global: globalAnalysis,
      countryLabel: overviewCountryLabel,
    })
  }, [
    analytics.summary,
    yearPreset,
    minMagnitude,
    nationalAnalysis,
    countryOverview,
    globalAnalysis,
    analysisCountryId,
  ])

  return {
    loading,
    error,
    truncated,
    requestUrl,
    resolved,
    yearPreset,
    dataQuality,
    refetch,
    events,
    nationalAnalysis,
    countryOverview,
    globalAnalysis,
    canAnalyzeByTime,
    hasTemporalAnalytics,
    temporalSummary: temporalAnalytics.summary,
    temporalCumulative: temporalAnalytics.cumulative,
    temporalAnnular: temporalAnalytics.annular,
    ...analytics,
  }
}
