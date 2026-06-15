import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildPresetApplyNotice,
  checkPropertyApiHealth,
  enrichProperty,
  fetchPropertyCatalog,
  isPaymentRequiredError,
  PRESET_OPTIONAL_ADDONS,
  presetSourceIds,
  quoteProperty,
  sourcesMatchPreset,
} from '../services/propertyApi'
import { formatRateLimitMessage, isRateLimitError } from '../utils/apiErrors'
import { getOrCreateAnonId } from '../utils/anonId'

const STORAGE_KEY = 'axiom:property-intelligence:report-state'

function loadSavedState() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveState(state) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage failures (quota / privacy modes)
  }
}

function clearSavedState() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function resetQuoteToEstimate(quote) {
  if (!quote) return quote
  const next = { ...quote, isFinal: false }
  delete next.report_id
  delete next.generated_at
  delete next.note
  if (Array.isArray(next.line_items)) {
    next.line_items = next.line_items.map(({ run_status, message, charged, ...item }) => item)
  }
  return next
}

export default function usePropertyReport() {
  const [catalog, setCatalog] = useState(null)
  const [selectedSources, setSelectedSources] = useState([])
  const [quote, setQuote] = useState(null)
  const [record, setRecord] = useState(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [quoteError, setQuoteError] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState(null)
  const [presetNotice, setPresetNotice] = useState(null)
  const [activePresetId, setActivePresetId] = useState(null)
  const [apiOnline, setApiOnline] = useState(null)
  const quoteTimer = useRef(null)
  const quoteRequestSeq = useRef(0)
  const skipNextScheduleRef = useRef(false)
  const savedStateRef = useRef(null)

  useEffect(() => {
    savedStateRef.current = loadSavedState()
    if (savedStateRef.current?.quote) setQuote(savedStateRef.current.quote)
    if (savedStateRef.current?.record) setRecord(savedStateRef.current.record)
    if (savedStateRef.current?.error) setError(savedStateRef.current.error)
    if (savedStateRef.current?.presetNotice) setPresetNotice(savedStateRef.current.presetNotice)
    if (savedStateRef.current?.activePresetId) setActivePresetId(savedStateRef.current.activePresetId)
  }, [])

  useEffect(() => {
    let cancelled = false
    checkPropertyApiHealth()
      .then(ok => {
        if (!cancelled) setApiOnline(ok)
      })
      .catch(() => {
        if (!cancelled) setApiOnline(false)
      })
    fetchPropertyCatalog()
      .then(data => {
        if (cancelled) return
        setCatalog(data)
        const saved = savedStateRef.current
        if (saved?.selectedSources?.length) setSelectedSources(saved.selectedSources)
        else setSelectedSources(data.default_selected ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load source catalog')
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    saveState({
      selectedSources,
      quote,
      record,
      error,
      presetNotice,
      activePresetId,
      updatedAt: Date.now(),
    })
  }, [selectedSources, quote, record, error, presetNotice, activePresetId])

  const toggleSource = useCallback(sourceId => {
    setSelectedSources(prev =>
      prev.includes(sourceId) ? prev.filter(id => id !== sourceId) : [...prev, sourceId],
    )
    if (!PRESET_OPTIONAL_ADDONS.includes(sourceId)) {
      setActivePresetId(null)
    }
    setRecord(null)
    setQuote(prev => resetQuoteToEstimate(prev))
  }, [])

  const applyPreset = useCallback(
    presetId => {
      const preset = catalog?.presets?.find(p => p.id === presetId)
      const ids = presetSourceIds(catalog, preset)
      if (!ids.length) return
      setSelectedSources(prev => {
        const keptAddons = prev.filter(id => PRESET_OPTIONAL_ADDONS.includes(id))
        return [...ids, ...keptAddons.filter(id => !ids.includes(id))]
      })
      setActivePresetId(presetId)
      setRecord(null)
      setQuote(prev => resetQuoteToEstimate(prev))
      setPresetNotice(buildPresetApplyNotice(catalog, preset, ids))
    },
    [catalog],
  )

  const refreshQuote = useCallback(
    (address, sources) => {
      const trimmed = address?.trim() ?? ''
      if (trimmed.length < 3 || !sources?.length) {
        setQuote(null)
        setQuoteError(null)
        setLoadingQuote(false)
        return
      }
      const requestId = ++quoteRequestSeq.current
      setLoadingQuote(true)
      setQuoteError(null)
      quoteProperty({ address: trimmed, selectedSources: sources })
        .then(q => {
          if (requestId !== quoteRequestSeq.current) return
          setQuote(q)
          setQuoteError(null)
        })
        .catch(err => {
          if (requestId !== quoteRequestSeq.current) return
          setQuote(null)
          if (isRateLimitError(err)) {
            const { title, safetyNote } = formatRateLimitMessage(err.rateLimit)
            setQuoteError(safetyNote ? `${title}\n${safetyNote}` : title)
          } else {
            setQuoteError(err?.message ?? 'Could not calculate estimate')
          }
        })
        .finally(() => {
          if (requestId === quoteRequestSeq.current) setLoadingQuote(false)
        })
    },
    [],
  )

  const toggleOptionalSource = useCallback(
    (sourceId, address) => {
      const trimmed = address?.trim() ?? ''
      const nextSources = selectedSources.includes(sourceId)
        ? selectedSources.filter(id => id !== sourceId)
        : [...selectedSources, sourceId]

      if (quoteTimer.current) clearTimeout(quoteTimer.current)
      skipNextScheduleRef.current = true
      setSelectedSources(nextSources)
      setRecord(null)
      setQuote(prev => resetQuoteToEstimate(prev))

      if (trimmed.length >= 3 && nextSources.length > 0) {
        refreshQuote(trimmed, nextSources)
      } else {
        setQuote(null)
        setQuoteError(null)
        setLoadingQuote(false)
      }
    },
    [selectedSources, refreshQuote],
  )

  const scheduleQuote = useCallback(
    (address, sources, delayMs = 250) => {
      if (skipNextScheduleRef.current) {
        skipNextScheduleRef.current = false
        return
      }
      if (quoteTimer.current) clearTimeout(quoteTimer.current)
      const trimmed = address?.trim() ?? ''
      if (trimmed.length < 3 || !sources?.length) {
        setQuote(null)
        setQuoteError(null)
        setLoadingQuote(false)
        return
      }
      setLoadingQuote(true)
      setQuoteError(null)
      quoteTimer.current = setTimeout(() => refreshQuote(trimmed, sources), delayMs)
    },
    [refreshQuote],
  )

  const runReport = useCallback(
    async ({ address, sourceUrls, sourceUrl }) => {
      if (!address?.trim()) return
      setLoadingReport(true)
      setError(null)
      try {
        const result = await enrichProperty({
          address,
          selectedSources,
          sourceUrl,
          sourceUrls,
          confirmedPriceUsd: quote?.totals?.user_price_usd,
          anonId: getOrCreateAnonId(),
        })
        setRecord(result)
        if (result.receipt) setQuote(prev => ({ ...prev, ...result.receipt, isFinal: true }))
        return result
      } catch (err) {
        let message
        if (isRateLimitError(err)) {
          const { title, safetyNote } = formatRateLimitMessage(err.rateLimit)
          message = safetyNote ? `${title}\n${safetyNote}` : title
        } else if (isPaymentRequiredError(err)) {
          message = 'Insufficient credits. Add credits below the title, then try again.'
        } else {
          message = err.message ?? 'Report failed'
        }
        setError(message)
        setRecord(null)
        throw err
      } finally {
        setLoadingReport(false)
      }
    },
    [selectedSources, quote],
  )

  const clearReport = useCallback(() => {
    setRecord(null)
    setError(null)
    setQuote(prev => resetQuoteToEstimate(prev))
  }, [])

  const clear = useCallback(() => {
    clearSavedState()
    setRecord(null)
    setQuote(null)
    setQuoteError(null)
    setError(null)
    setActivePresetId(null)
    if (catalog?.default_selected) setSelectedSources(catalog.default_selected)
  }, [catalog])

  const resolvedPresetId =
    activePresetId && catalog && sourcesMatchPreset(catalog, activePresetId, selectedSources)
      ? activePresetId
      : null

  return {
    catalog,
    selectedSources,
    setSelectedSources,
    toggleSource,
    toggleOptionalSource,
    applyPreset,
    quote,
    scheduleQuote,
    refreshQuote,
    record,
    loadingCatalog,
    loadingQuote,
    quoteError,
    loadingReport,
    loading: loadingReport,
    error,
    presetNotice,
    clearPresetNotice: () => setPresetNotice(null),
    activePresetId: resolvedPresetId,
    apiOnline,
    runReport,
    clearReport,
    clear,
  }
}
