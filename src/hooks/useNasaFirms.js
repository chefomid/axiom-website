import { useEffect, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchNasaFirms } from '../services/nasaFirms'
import { getStaleRiskCache, riskCacheKey } from '../utils/riskCache'
import useFeedRetry from './useFeedRetry'
import {
  feedFailedMessage,
  feedLoadedMessage,
  shouldAnnounceFeedLoad,
  telemetrySourceForLayer,
} from '../utils/userTelemetry'
import { riskEventsToPoints } from '../utils/riskNormalize'

const FIRMS_DAY_RANGE = 1

const EMPTY_META = {
  sourceName: 'NASA FIRMS',
  lastFetchedAt: null,
  recordCount: 0,
  requestUrl: null,
  stale: false,
}

function firmsCacheKey(scopeConfig) {
  const mapKey = import.meta.env.VITE_NASA_FIRMS_MAP_KEY?.trim()
  const provider = mapKey ? 'firms' : 'eonet'
  return riskCacheKey([
    provider,
    scopeConfig.scope,
    scopeConfig.countryId,
    scopeConfig.userLocation?.lat,
    scopeConfig.radiusMiles,
    FIRMS_DAY_RANGE,
  ])
}

function applyFirmsResult(result, { fetchedAt, stale = false }) {
  const points = riskEventsToPoints(result.events)
  return {
    points,
    meta: {
      sourceName: 'NASA FIRMS',
      lastFetchedAt: fetchedAt,
      recordCount: points.length,
      requestUrl: result.requestUrl ?? null,
      stale,
    },
  }
}

export default function useNasaFirms({ scope, userLocation, radiusMiles, countryId, enabled }) {
  const { pushEvent } = useTelemetry()
  const { retryAt, scheduleRetry, clearRetry } = useFeedRetry()
  const [markers, setMarkers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState(EMPTY_META)

  useEffect(() => {
    if (!enabled) {
      setMarkers([])
      setError(null)
      setLoading(false)
      setMeta(EMPTY_META)
      clearRetry()
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const scopeConfig = { scope, userLocation, radiusMiles, countryId }
    const cacheKey = firmsCacheKey(scopeConfig)

    async function load() {
      setLoading(true)
      setError(null)
      clearRetry()

      try {
        const result = await fetchNasaFirms(scopeConfig, { signal: controller.signal })
        if (cancelled) return

        const { points, meta: nextMeta } = applyFirmsResult(result, { fetchedAt: new Date() })
        setMarkers(points)
        setMeta(nextMeta)

        if (shouldAnnounceFeedLoad(result.fromCache)) {
          pushEvent({
            text: feedLoadedMessage('wildfire', points.length),
            type: points.length > 0 ? 'stable' : 'watch',
            source: telemetrySourceForLayer('wildfire'),
          })
        }
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load NASA FIRMS data'
        const staleEntry = getStaleRiskCache('firms', cacheKey)

        if (staleEntry?.data) {
          const { points, meta: staleMeta } = applyFirmsResult(staleEntry.data, {
            fetchedAt: new Date(staleEntry.fetchedAt),
            stale: true,
          })
          setMarkers(points)
          setMeta(staleMeta)
        } else {
          setMarkers([])
          setMeta(EMPTY_META)
        }

        setError(message)
        scheduleRetry(() => {
          if (!cancelled) load()
        })
        pushEvent({
          text: feedFailedMessage('NASA FIRMS', message, { stale: !!staleEntry?.data }),
          type: staleEntry?.data ? 'watch' : 'critical',
          source: telemetrySourceForLayer('wildfire'),
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 15 * 60 * 1000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
      clearRetry()
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent, clearRetry, scheduleRetry])

  return { markers, loading, error, errorRetryAt: retryAt, meta }
}
