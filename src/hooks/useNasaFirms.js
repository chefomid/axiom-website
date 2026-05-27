import { useEffect, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchNasaFirms } from '../services/nasaFirms'
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

      pushEvent({ text: 'NASA wildfire feed request started', type: 'live', source: 'NASA' })

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

        const cacheNote = result.fromCache ? ' (cache)' : ''
        const feedLabel = result.provider === 'firms' ? 'FIRMS' : 'EONET'
        const fallbackNote = result.usingFallback ? ' · add VITE_NASA_FIRMS_MAP_KEY for FIRMS hotspots' : ''
        pushEvent({
          text: `NASA ${feedLabel} returned ${points.length} fire event${points.length === 1 ? '' : 's'}${cacheNote}${fallbackNote}`,
          type: points.length > 0 ? 'stable' : 'watch',
          source: 'NASA',
        })
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load NASA FIRMS data'
        setError(message)
        setMarkers([])
        setMeta(EMPTY_META)
        pushEvent({ text: `NASA FIRMS failed — ${message}`, type: 'critical', source: 'NASA' })
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
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent])

  return { markers, loading, error, meta }
}
