import { useEffect, useState } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { fetchNwsAlerts } from '../services/nwsAlerts'
import { riskEventsToZones } from '../utils/riskNormalize'

const EMPTY_META = {
  sourceName: 'NWS',
  lastFetchedAt: null,
  recordCount: 0,
  requestUrl: null,
}

export default function useNwsAlerts({ scope, userLocation, radiusMiles, countryId, enabled }) {
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
      pushEvent({ text: 'NWS active alerts request started', type: 'live', source: 'NWS' })

      try {
        const result = await fetchNwsAlerts(scopeConfig, { signal: controller.signal })
        if (cancelled) return

        const zoneList = riskEventsToZones(result.events)
        const markers = zoneList.map(z => ({ ...z.marker, geometry: z.geometry }))
        const fetchedAt = new Date()

        setZones(markers)
        setMeta({
          sourceName: 'NWS',
          lastFetchedAt: fetchedAt,
          recordCount: markers.length,
          requestUrl: result.requestUrl,
        })

        const cacheNote = result.fromCache ? ' (cache)' : ''
        pushEvent({
          text: `NWS returned ${markers.length} alert zone${markers.length === 1 ? '' : 's'}${cacheNote}`,
          type: markers.length > 0 ? 'stable' : 'watch',
          source: 'NWS',
        })
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return
        const message = err.message ?? 'Failed to load NWS data'
        setError(message)
        setZones([])
        setMeta(EMPTY_META)
        pushEvent({ text: `NWS request failed — ${message}`, type: 'critical', source: 'NWS' })
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
    }
  }, [scope, userLocation?.lat, userLocation?.lng, radiusMiles, countryId, enabled, pushEvent])

  return { zones, zoneGeometries: zones, loading, error, meta }
}
