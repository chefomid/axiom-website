import { useCallback, useEffect, useState } from 'react'
import { checkPropertyApiHealth, enrichProperty } from '../services/propertyApi'

export default function usePropertyEnrichment() {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [apiOnline, setApiOnline] = useState(null)

  useEffect(() => {
    let cancelled = false
    checkPropertyApiHealth()
      .then(ok => {
        if (!cancelled) setApiOnline(ok)
      })
      .catch(() => {
        if (!cancelled) setApiOnline(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enrich = useCallback(async ({ address, sourceUrl }) => {
    setLoading(true)
    setError(null)
    try {
      const result = await enrichProperty({ address, sourceUrl })
      setRecord(result)
      return result
    } catch (err) {
      const message = err.message ?? 'Enrichment failed'
      setError(message)
      setRecord(null)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setRecord(null)
    setError(null)
  }, [])

  return { record, loading, error, apiOnline, enrich, clear }
}
