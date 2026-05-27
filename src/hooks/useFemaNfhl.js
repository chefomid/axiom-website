import { useEffect, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchFemaNfhlZones } from '../services/femaNfhl'
import { riskEventsToZones } from '../utils/riskNormalize'

const EMPTY_META = {
  sourceName: 'FEMA NFHL',
  lastFetchedAt: null,
  recordCount: 0,
  requestUrl: null,
  rasterUrl: null,
  bbox: null,
}

export default function useFemaNfhl({ scope, userLocation, radiusMiles, countryId, enabled }) {
  const { pushEvent } = useTelemetry()
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
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const scopeConfig = { scope, userLocation, radiusMiles, countryId }

    async function load() {
      setLoading(true)
      setError(null)
      pushEvent({ text: 'FEMA NFHL flood zone request started', type: 'live', source: 'FEMA' })

      try {
        const result = await fetchFemaNfhlZones(scopeConfig, { signal: controller.signal })
        if (cancelled) return

        const zoneList = riskEventsToZones(result.events)
        const markers = zoneList.map(z => ({ ...z.marker, geometry: z.geometry }))
        const fetchedAt = new Date()

        setZones(markers)
        setMeta({
          sourceName: 'FEMA NFHL',
          lastFetchedAt: fetchedAt,
          recordCount: markers.length,
          requestUrl: result.requestUrl,
          rasterUrl: result.rasterUrl,
          bbox: result.bbox,
        })

        const cacheNote = result.fromCache ? ' (cache)' : ''
        pushEvent({
          text: `FEMA NFHL returned ${markers.length} flood zone${markers.length === 1 ? '' : 's'}${cacheNote}`,
          type: markers.length > 0 ? 'stable' : 'watch',
          source: 'FEMA',
        })
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load FEMA NFHL data'
        setError(message)
        setZones([])
        setMeta(EMPTY_META)
        pushEvent({ text: `FEMA NFHL failed — ${message}`, type: 'critical', source: 'FEMA' })
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
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent])

  return { zones, loading, error, meta }
}
