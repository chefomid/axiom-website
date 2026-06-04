import { useEffect, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchNwsAlerts } from '../services/nwsAlerts'
import { getStaleRiskCache, riskCacheKey } from '../utils/riskCache'
import { riskEventsToZones } from '../utils/riskNormalize'
import useFeedRetry from './useFeedRetry'
import {
  feedFailedMessage,
  feedLoadedMessage,
  shouldAnnounceFeedLoad,
  telemetrySourceForLayer,
} from '../utils/userTelemetry'

const EMPTY_META = {
  sourceName: 'NWS',
  lastFetchedAt: null,
  recordCount: 0,
  requestUrl: null,
  stale: false,
}

function nwsCacheKey(scopeConfig) {
  return riskCacheKey([
    scopeConfig.scope,
    scopeConfig.countryId,
    scopeConfig.userLocation?.lat,
    scopeConfig.userLocation?.lng,
    scopeConfig.radiusMiles,
  ])
}

function applyNwsResult(result, { fetchedAt, stale = false }) {
  const zoneList = riskEventsToZones(result.events)
  const markers = zoneList.map(z => ({ ...z.marker, geometry: z.geometry }))
  return {
    markers,
    meta: {
      sourceName: 'NWS',
      lastFetchedAt: fetchedAt,
      recordCount: markers.length,
      requestUrl: result.requestUrl ?? null,
      stale,
    },
  }
}

export default function useNwsAlerts({ scope, userLocation, radiusMiles, countryId, enabled }) {
  const { pushEvent } = useTelemetry()
  const { retryAt, scheduleRetry, clearRetry } = useFeedRetry()
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState(EMPTY_META)

  useEffect(() => {
    if (!enabled) {
      setZones([])
      setError(null)
      setLoading(false)
      setMeta(EMPTY_META)
      clearRetry()
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const scopeConfig = { scope, userLocation, radiusMiles, countryId }
    const cacheKey = nwsCacheKey(scopeConfig)

    async function load() {
      setLoading(true)
      setError(null)
      clearRetry()

      try {
        const result = await fetchNwsAlerts(scopeConfig, { signal: controller.signal })
        if (cancelled) return

        const { markers, meta: nextMeta } = applyNwsResult(result, { fetchedAt: new Date() })
        setZones(markers)
        setMeta(nextMeta)

        if (shouldAnnounceFeedLoad(result.fromCache)) {
          pushEvent({
            text: feedLoadedMessage('weather', markers.length),
            type: markers.length > 0 ? 'stable' : 'watch',
            source: telemetrySourceForLayer('weather'),
          })
        }
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load NWS data'
        const staleEntry = getStaleRiskCache('nws', cacheKey)

        if (staleEntry?.data) {
          const { markers, meta: staleMeta } = applyNwsResult(staleEntry.data, {
            fetchedAt: new Date(staleEntry.fetchedAt),
            stale: true,
          })
          setZones(markers)
          setMeta(staleMeta)
        } else {
          setZones([])
          setMeta(EMPTY_META)
        }

        setError(message)
        scheduleRetry(() => {
          if (!cancelled) load()
        })
        pushEvent({
          text: feedFailedMessage('NWS', message, { stale: !!staleEntry?.data }),
          type: staleEntry?.data ? 'watch' : 'critical',
          source: telemetrySourceForLayer('weather'),
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 3 * 60 * 1000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
      clearRetry()
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent, clearRetry, scheduleRetry])

  return { zones, zoneGeometries: zones, loading, error, errorRetryAt: retryAt, meta }
}
