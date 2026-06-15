import { useCallback, useRef, useState } from 'react'
import { enrichBatch, fetchBatchCheckoutPreview, quoteBatch, startQuoteCheckout } from '../services/propertyApi'
import { getOrCreateAnonId } from '../utils/anonId'

export default function usePropertyBatch() {
  const batchQuoteRequestSeq = useRef(0)
  const [batchQuote, setBatchQuote] = useState(null)
  const [batchRun, setBatchRun] = useState(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [loadingRun, setLoadingRun] = useState(false)
  const [quoteError, setQuoteError] = useState(null)
  const [runError, setRunError] = useState(null)
  const [checkoutPreview, setCheckoutPreview] = useState(null)

  const clearBatch = useCallback(() => {
    setBatchQuote(null)
    setBatchRun(null)
    setQuoteError(null)
    setRunError(null)
    setCheckoutPreview(null)
  }, [])

  const markBatchQuotePending = useCallback(() => {
    setBatchQuote(null)
    setLoadingQuote(true)
    setQuoteError(null)
  }, [])

  const requestBatchQuote = useCallback(async (addresses, selectedSources) => {
    const requestId = ++batchQuoteRequestSeq.current
    setLoadingQuote(true)
    setQuoteError(null)
    setBatchRun(null)
    setBatchQuote(null)
    try {
      const data = await quoteBatch({ addresses, selectedSources })
      if (requestId !== batchQuoteRequestSeq.current) return data
      setBatchQuote(data)
      return data
    } catch (err) {
      if (requestId !== batchQuoteRequestSeq.current) throw err
      setQuoteError(err?.message ?? 'Batch quote failed')
      setBatchQuote(null)
      throw err
    } finally {
      if (requestId === batchQuoteRequestSeq.current) setLoadingQuote(false)
    }
  }, [])

  const refreshCheckoutPreview = useCallback(async (addresses, selectedSources) => {
    if (!addresses?.length || !selectedSources?.length) {
      setCheckoutPreview(null)
      return null
    }
    try {
      const data = await fetchBatchCheckoutPreview({
        addresses,
        selectedSources,
        anonId: getOrCreateAnonId(),
      })
      setCheckoutPreview(data)
      return data
    } catch {
      setCheckoutPreview(null)
      return null
    }
  }, [])

  const runBatch = useCallback(async ({ addresses, selectedSources, confirmedPriceUsd }) => {
    setLoadingRun(true)
    setRunError(null)
    try {
      const data = await enrichBatch({
        addresses,
        selectedSources,
        confirmedPriceUsd,
        anonId: getOrCreateAnonId(),
      })
      setBatchRun(data)
      return data
    } catch (err) {
      setRunError(err?.message ?? 'Batch analysis failed')
      throw err
    } finally {
      setLoadingRun(false)
    }
  }, [])

  const payAndRunBatch = useCallback(
    async ({ addresses, selectedSources, confirmedPriceUsd, resumeContext }) => {
      return startQuoteCheckout({
        purpose: 'batch_enrich',
        address: addresses[0] ?? '',
        addresses,
        selectedSources,
        confirmedPriceUsd,
        resumeContext: {
          mode: 'batch',
          addresses,
          selectedSources,
          confirmedPriceUsd,
          batchQuoteSnapshot: batchQuote,
          ...resumeContext,
        },
      })
    },
    [batchQuote],
  )

  const validLocationCount =
    batchQuote?.locations?.filter(loc => loc.status === 'valid').length ?? 0

  return {
    batchQuote,
    batchRun,
    loadingQuote,
    loadingRun,
    quoteError,
    runError,
    checkoutPreview,
    validLocationCount,
    requestBatchQuote,
    refreshCheckoutPreview,
    runBatch,
    payAndRunBatch,
    clearBatch,
    markBatchQuotePending,
    setBatchQuote,
    setBatchRun,
  }
}
