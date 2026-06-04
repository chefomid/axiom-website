import { useEffect, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchFemaNfhlZones } from '../services/femaNfhl'
import { getStaleRiskCache, riskCacheKey } from '../utils/riskCache'
import { getScopeBbox } from '../utils/scopeBbox'
import { riskEventsToZones } from '../utils/riskNormalize'
import useFeedRetry from './useFeedRetry'
import {
  feedFailedMessage,
  feedLoadedMessage,
  shouldAnnounceFeedLoad,
  telemetrySourceForLayer,
} from '../utils/userTelemetry'

const EMPTY_META = {
  sourceName: 'FEMA NFHL',
  lastFetchedAt: null,
  recordCount: 0,
  requestUrl: null,
  rasterUrl: null,
  bbox: null,
  stale: false,
}

function nfhlCacheKey(scopeConfig) {
  const bbox = getScopeBbox(scopeConfig)
  return riskCacheKey([
    scopeConfig.scope,
    scopeConfig.countryId,
    bbox.west,
    bbox.south,
    bbox.east,
    bbox.north,
  ])
}

function applyNfhlResult(result, { fetchedAt, stale = false }) {
  const zoneList = riskEventsToZones(result.events)
  const markers = zoneList.map(z => ({ ...z.marker, geometry: z.geometry }))
  return {
    markers,
    meta: {
      sourceName: 'FEMA NFHL',
      lastFetchedAt: fetchedAt,
      recordCount: markers.length,
      requestUrl: result.requestUrl ?? null,
      rasterUrl: result.rasterUrl ?? null,
      bbox: result.bbox ?? null,
      stale,
    },
  }
}

export default function useFemaNfhl({ scope, userLocation, radiusMiles, countryId, enabled }) {
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
    const cacheKey = nfhlCacheKey(scopeConfig)

    async function load() {
      setLoading(true)
      setError(null)
      clearRetry()

      try {
        const result = await fetchFemaNfhlZones(scopeConfig, { signal: controller.signal })
        if (cancelled) return

        const { markers, meta: nextMeta } = applyNfhlResult(result, { fetchedAt: new Date() })
        setZones(markers)
        setMeta(nextMeta)

        if (shouldAnnounceFeedLoad(result.fromCache)) {
          pushEvent({
            text: feedLoadedMessage('flood', markers.length),
            type: markers.length > 0 ? 'stable' : 'watch',
            source: telemetrySourceForLayer('flood'),
          })
        }
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load FEMA NFHL data'
        const staleEntry = getStaleRiskCache('nfhl', cacheKey)

        if (staleEntry?.data) {
          const { markers, meta: staleMeta } = applyNfhlResult(staleEntry.data, {
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
          text: feedFailedMessage('FEMA NFHL', message, { stale: !!staleEntry?.data }),
          type: staleEntry?.data ? 'watch' : 'critical',
          source: telemetrySourceForLayer('flood'),
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 24 * 60 * 60 * 1000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
      clearRetry()
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent, clearRetry, scheduleRetry])

  return { zones, loading, error, errorRetryAt: retryAt, meta }
}
