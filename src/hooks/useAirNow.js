import { useEffect, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchAirNow } from '../services/airNow'
import { riskEventsToPoints } from '../utils/riskNormalize'

const EMPTY_META = {
  sourceName: 'AirNow',
  lastFetchedAt: null,
  recordCount: 0,
  requestUrl: null,
}

export default function useAirNow({ scope, userLocation, radiusMiles, countryId, enabled }) {
  const { pushEvent } = useTelemetry()
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
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const scopeConfig = { scope, userLocation, radiusMiles, countryId }

    async function load() {
      setLoading(true)
      setError(null)
      pushEvent({ text: 'EPA air quality feed request started', type: 'live', source: 'EPA' })

      try {
        const result = await fetchAirNow(scopeConfig, { signal: controller.signal })
        if (cancelled) return

        const points = riskEventsToPoints(result.events)
        const fetchedAt = new Date()
        setMarkers(points)
        setMeta({
          sourceName: result.provider === 'airnow' ? 'EPA AirNow' : 'Open-Meteo',
          lastFetchedAt: fetchedAt,
          recordCount: points.length,
          requestUrl: result.requestUrl,
        })

        const cacheNote = result.fromCache ? ' (cache)' : ''
        const feedLabel = result.provider === 'airnow' ? 'EPA AirNow' : 'Open-Meteo'
        const fallbackNote = result.usingFallback
          ? ' · using Open-Meteo grid (set VITE_AIRNOW_API_KEY in .env for EPA station data)'
          : ''
        pushEvent({
          text: `Air quality · ${feedLabel} returned ${points.length} sample${points.length === 1 ? '' : 's'}${cacheNote}${fallbackNote}`,
          type: points.length > 0 ? 'stable' : 'watch',
          source: 'EPA',
        })
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load air quality data'
        setError(message)
        setMarkers([])
        setMeta(EMPTY_META)
        pushEvent({ text: `Air quality failed — ${message}`, type: 'critical', source: 'EPA' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 30 * 60 * 1000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent])

  return { markers, loading, error, meta }
}
