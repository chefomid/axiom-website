import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import { filterEventsByMinMagnitude } from '../utils/earthquakeMagnitude'
import { getRiskCache, riskCacheKey, setRiskCache } from '../utils/riskCache'

const EMPTY_ANALYTICS = {
  summary: null,
  cumulative: [],
  annular: [],
}

function buildHistoryCacheKey({
  globalAnalysis,
  countryOverview,
  analysisCountryId,
  center,
  maxRadiusMiles,
  yearPresetId,
  startDate,
  endDate,
}) {
  return riskCacheKey([
    'stratified-history-v5',
    globalAnalysis
      ? 'global-worldwide-v5'
      : countryOverview
        ? `national-bbox-${analysisCountryId}`
        : 'local',
    analysisCountryId,
    center.lat,
    center.lng,
    maxRadiusMiles,
    yearPresetId,
    startDate.toISOString().slice(0, 10),
    endDate.toISOString().slice(0, 10),
  ])
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
  const [catalogEvents, setCatalogEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [truncated, setTruncated] = useState(false)
  const [requestUrl, setRequestUrl] = useState(null)
  const [loadedQueryKey, setLoadedQueryKey] = useState(null)
  const [fetchTick, setFetchTick] = useState(0)
  const stableAnalyticsRef = useRef(EMPTY_ANALYTICS)
  const stableTemporalRef = useRef(EMPTY_ANALYTICS)

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

  const queryKey = useMemo(() => {
    const { center } = resolved
    if (!center?.lat || !center?.lng) return null
    return buildHistoryCacheKey({
      globalAnalysis,
      countryOverview,
      analysisCountryId,
      center,
      maxRadiusMiles,
      yearPresetId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    })
  }, [
    resolved.center,
    globalAnalysis,
    countryOverview,
    analysisCountryId,
    maxRadiusMiles,
    yearPresetId,
    historyRangeKey,
  ])

  const events = useMemo(
    () => filterEventsByMinMagnitude(catalogEvents, minMagnitude),
    [catalogEvents, minMagnitude],
  )

  const refreshing = Boolean(queryKey && loadedQueryKey !== queryKey)

  useEffect(() => {
    if (!enabled) {
      setCatalogEvents([])
      setError(null)
      setLoading(false)
      setTruncated(false)
      setRequestUrl(null)
      setLoadedQueryKey(null)
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

      const cacheKey = buildHistoryCacheKey({
        globalAnalysis,
        countryOverview,
        analysisCountryId,
        center,
        maxRadiusMiles,
        yearPresetId,
        startDate,
        endDate,
      })

      const cached = getRiskCache('usgs-history', cacheKey)
      if (cached) {
        if (cancelled) return
        setCatalogEvents(cached.events)
        setTruncated(cached.truncated)
        setRequestUrl(cached.requestUrl)
        setLoadedQueryKey(cacheKey)
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const result = await fetchUsgsEarthquakeHistory(
          {
            center,
            maxRadiusMiles,
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

        setCatalogEvents(result.events)
        setTruncated(result.truncated)
        setRequestUrl(result.requestUrl)
        setLoadedQueryKey(cacheKey)
        if (globalAnalysis && result.events.length === 0) {
          setError('Global catalog returned no events. Check your connection and use Retry in the sidebar.')
        } else if (globalAnalysis && result.events.length > 0) {
          setError(null)
        }
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        setError(err.message ?? 'Failed to load earthquake history')
        setCatalogEvents([])
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
    maxRadiusMiles,
    yearPresetId,
    historyRangeKey,
    fetchTick,
  ])

  const analytics = useMemo(() => {
    if (refreshing) {
      return loadedQueryKey === null ? EMPTY_ANALYTICS : stableAnalyticsRef.current
    }

    let next = EMPTY_ANALYTICS

    if (globalAnalysis) {
      if (!events.length) {
        if (loading || error) next = EMPTY_ANALYTICS
        else next = computeGlobalEarthquakeAnalytics([], dateRange.yearsInRange)
      } else {
        next = computeGlobalEarthquakeAnalytics(events, dateRange.yearsInRange)
      }
    } else if (!events.length) {
      if (loading || error) next = EMPTY_ANALYTICS
      else next = computeEarthquakeAnalytics([], resolved.center, activeBreakpoints, dateRange.yearsInRange)
    } else {
      next = computeEarthquakeAnalytics(
        events,
        resolved.center,
        activeBreakpoints,
        dateRange.yearsInRange,
      )
    }

    stableAnalyticsRef.current = next
    return next
  }, [
    refreshing,
    loadedQueryKey,
    globalAnalysis,
    events,
    resolved.center,
    activeBreakpoints,
    dateRange.yearsInRange,
    loading,
    error,
  ])

  const canAnalyzeByTime = isSpecificAnalysisLocation(centerOverride, countryOverview)
  const hasTemporalAnalytics = supportsTemporalAnalytics(centerOverride, globalAnalysis)

  const temporalAnalytics = useMemo(() => {
    if (!hasTemporalAnalytics) return EMPTY_ANALYTICS
    if (refreshing) {
      return loadedQueryKey === null ? EMPTY_ANALYTICS : stableTemporalRef.current
    }

    const { startDate, endDate } = dateRange
    const next = computeTemporalEarthquakeAnalytics(
      events,
      resolved.center,
      maxRadiusMiles,
      startDate,
      endDate,
    )
    stableTemporalRef.current = next
    return next
  }, [
    hasTemporalAnalytics,
    refreshing,
    loadedQueryKey,
    events,
    resolved.center,
    maxRadiusMiles,
    dateRange,
  ])

  const dataQuality = useMemo(() => {
    if (refreshing) return null
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
    refreshing,
  ])

  return {
    loading,
    refreshing,
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
