import { useEffect, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchUsgsEarthquakes } from '../services/usgsEarthquakes'
import { getRiskCache, setRiskCache, riskCacheKey } from '../utils/riskCache'
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
  const [markers, setMarkers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState(EMPTY_META)

  useEffect(() => {
    if (!enabled || (scope === 'local' && !userLocation)) {
      setMarkers([])
      setError(null)
      setLoading(false)
      setMeta(EMPTY_META)
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const scopeConfig = { scope, userLocation, radiusMiles, countryId, minMagnitude }

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const cacheKey = riskCacheKey([
          scope,
          countryId,
          userLocation?.lat,
          userLocation?.lng,
          radiusMiles,
          minMagnitude,
        ])
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

        const fetchedAt = new Date()
        setMarkers(results)
        setMeta({
          sourceName: 'USGS',
          lastFetchedAt: fetchedAt,
          recordCount: results.length,
          requestUrl,
        })
        if (shouldAnnounceFeedLoad(fromCache)) {
          pushEvent({
            text: feedLoadedMessage('earthquake', results.length, { minMagnitude }),
            type: results.length > 0 ? 'stable' : 'watch',
            source: telemetrySourceForLayer('earthquake'),
          })
        }
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load USGS data'
        setError(message)
        setMarkers([])
        setMeta(EMPTY_META)
        pushEvent({
          text: feedFailedMessage('USGS', message),
          type: 'critical',
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
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, minMagnitude, enabled, pushEvent])

  return { markers, loading, error, meta }
}
