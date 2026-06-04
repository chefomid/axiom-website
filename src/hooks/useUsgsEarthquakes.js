import { useEffect, useMemo, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchUsgsEarthquakes } from '../services/usgsEarthquakes'
import { getRiskCache, getStaleRiskCache, setRiskCache, riskCacheKey } from '../utils/riskCache'
import { filterMarkersByMinMagnitude } from '../utils/earthquakeMagnitude'
import useFeedRetry from './useFeedRetry'
import {
  feedFailedMessage,
  feedLoadedMessage,
  shouldAnnounceFeedLoad,
  telemetrySourceForLayer,
} from '../utils/userTelemetry'

const EMPTY_META = {
  sourceName: 'USGS',
  lastFetchedAt: null,
  recordCount: 0,
  requestUrl: null,
  stale: false,
}

function usgsCacheKey(scopeConfig) {
  const { scope, countryId, userLocation, radiusMiles } = scopeConfig
  return riskCacheKey(['usgs-feed-v2', scope, countryId, userLocation?.lat, userLocation?.lng, radiusMiles])
}

export default function useUsgsEarthquakes({
  scope,
  userLocation,
  radiusMiles,
  countryId,
  minMagnitude,
  enabled,
}) {
  const { pushEvent } = useTelemetry()
  const { retryAt, scheduleRetry, clearRetry } = useFeedRetry()
  const [catalogMarkers, setCatalogMarkers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState(EMPTY_META)

  const markers = useMemo(
    () => filterMarkersByMinMagnitude(catalogMarkers, minMagnitude),
    [catalogMarkers, minMagnitude],
  )

  useEffect(() => {
    if (!enabled || (scope === 'local' && !userLocation)) {
      setCatalogMarkers([])
      setError(null)
      setLoading(false)
      setMeta(EMPTY_META)
      clearRetry()
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const scopeConfig = { scope, userLocation, radiusMiles, countryId }
    const cacheKey = usgsCacheKey(scopeConfig)

    async function load() {
      setLoading(true)
      setError(null)
      clearRetry()

      try {
        let results
        let requestUrl
        let fromCache = false

        const cached = getRiskCache('usgs', cacheKey)
        if (cached) {
          results = cached.markers
          requestUrl = cached.requestUrl
          fromCache = true
        } else {
          const response = await fetchUsgsEarthquakes(scopeConfig, {
            signal: controller.signal,
          })
          results = response.markers
          requestUrl = response.requestUrl
          setRiskCache('usgs', cacheKey, { markers: results, requestUrl })
        }

        if (cancelled) return

        setCatalogMarkers(results)
        setMeta({
          sourceName: 'USGS',
          lastFetchedAt: new Date(),
          recordCount: filterMarkersByMinMagnitude(results, minMagnitude).length,
          requestUrl,
          stale: false,
        })

        if (shouldAnnounceFeedLoad(fromCache)) {
          const visibleCount = filterMarkersByMinMagnitude(results, minMagnitude).length
          pushEvent({
            text: feedLoadedMessage('earthquake', visibleCount, { minMagnitude }),
            type: results.length > 0 ? 'stable' : 'watch',
            source: telemetrySourceForLayer('earthquake'),
          })
        }
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load USGS data'
        const staleEntry = getStaleRiskCache('usgs', cacheKey)

        if (staleEntry?.data) {
          const { markers: staleMarkers, requestUrl } = staleEntry.data
          setCatalogMarkers(staleMarkers ?? [])
          setMeta({
            sourceName: 'USGS',
            lastFetchedAt: new Date(staleEntry.fetchedAt),
            recordCount: filterMarkersByMinMagnitude(staleMarkers ?? [], minMagnitude).length,
            requestUrl: requestUrl ?? null,
            stale: true,
          })
        } else {
          setCatalogMarkers([])
          setMeta(EMPTY_META)
        }

        setError(message)
        scheduleRetry(() => {
          if (!cancelled) load()
        })
        pushEvent({
          text: feedFailedMessage('USGS', message, { stale: !!staleEntry?.data }),
          type: staleEntry?.data ? 'watch' : 'critical',
          source: telemetrySourceForLayer('earthquake'),
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 5 * 60 * 1000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
      clearRetry()
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent, clearRetry, scheduleRetry])

  return {
    markers,
    loading,
    error,
    errorRetryAt: retryAt,
    meta: { ...meta, recordCount: markers.length },
  }
}
