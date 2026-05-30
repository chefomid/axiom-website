import { useEffect, useRef, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchNasaFirms } from '../services/nasaFirms'
import { FEED_RETRY_DELAY_MS, isTransientFeedError } from '../utils/feedErrors'
import {
  feedFailedMessage,
  feedLoadedMessage,
  shouldAnnounceFeedLoad,
  telemetrySourceForLayer,
} from '../utils/userTelemetry'
import { riskEventsToPoints } from '../utils/riskNormalize'

const EMPTY_META = {
  sourceName: 'NASA FIRMS',
  lastFetchedAt: null,
  recordCount: 0,
  requestUrl: null,
}

export default function useNasaFirms({ scope, userLocation, radiusMiles, countryId, enabled }) {
  const { pushEvent } = useTelemetry()
  const [markers, setMarkers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [errorRetryAt, setErrorRetryAt] = useState(null)
  const [meta, setMeta] = useState(EMPTY_META)
  const retryTimerRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      setMarkers([])
      setError(null)
      setErrorRetryAt(null)
      setLoading(false)
      setMeta(EMPTY_META)
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const scopeConfig = { scope, userLocation, radiusMiles, countryId }

    async function load() {
      setLoading(true)
      setError(null)
      setErrorRetryAt(null)
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }

      try {
        const result = await fetchNasaFirms(scopeConfig, { signal: controller.signal })
        if (cancelled) return

        const points = riskEventsToPoints(result.events)
        const fetchedAt = new Date()
        setMarkers(points)
        setMeta({
          sourceName: 'NASA FIRMS',
          lastFetchedAt: fetchedAt,
          recordCount: points.length,
          requestUrl: result.requestUrl,
        })

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
        setError(message)
        setMarkers([])
        setMeta(EMPTY_META)
        pushEvent({
          text: feedFailedMessage('NASA FIRMS', message),
          type: 'critical',
          source: telemetrySourceForLayer('wildfire'),
        })

        if (isTransientFeedError(message) && !retryTimerRef.current) {
          const retryAt = Date.now() + FEED_RETRY_DELAY_MS
          setErrorRetryAt(retryAt)
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            if (!cancelled) load()
          }, FEED_RETRY_DELAY_MS)
        }
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
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent])

  return { markers, loading, error, errorRetryAt, meta }
}
