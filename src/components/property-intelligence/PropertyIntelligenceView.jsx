import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { SEISMIC_COUNTRY_BBOX } from '../../data/commandMapData'

import { resolveUsLocationFromCoords, inBbox } from '../../services/geocode'
import { normalizeLatLng, normalizeSuggestion } from '../../utils/coords'
import { sourcesNeedingUrlIds, fetchBillingPacks, fetchCheckoutPreview, fetchBatchCheckoutPreview, startQuoteCheckout, sourcesMatchQuote, formatUsd, isPaymentRequiredError } from '../../services/propertyApi'
import { loadBillingResume, clearBillingResume } from '../../utils/billingResume'
import { adoptAnonIdFromSearchParams } from '../../utils/anonId'

import usePropertyReport from '../../hooks/usePropertyReport'
import useGeolocation from '../../hooks/useGeolocation'
import usePropertyBatch from '../../hooks/usePropertyBatch'
import { useCheckoutPay } from '../../hooks/useCheckoutPay'

import PropertyHeader from './PropertyHeader'

import PropertyMap from './PropertyMap'

import PropertyWorkflowHud from './PropertyWorkflowHud'

import ReportResultsPanel from './ReportResultsPanel'
import ScheduleUploadModal from './ScheduleUploadModal'
import BatchResultsPanel from './BatchResultsPanel'

export default function PropertyIntelligenceView() {

  const { presentCheckout } = useCheckoutPay()
  const [searchParams, setSearchParams] = useSearchParams()
  const [addressDraft, setAddressDraft] = useState('')
  const [address, setAddress] = useState('')

  const [sourceUrls, setSourceUrls] = useState({})

  const [mapView, setMapView] = useState(null)

  const [resolvingAddress, setResolvingAddress] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [addressSearching, setAddressSearching] = useState(false)
  const [locateSuccess, setLocateSuccess] = useState(false)
  const [geolocateCommitting, setGeolocateCommitting] = useState(false)
  const composeTimerRef = useRef(null)
  const [addressComposing, setAddressComposing] = useState(false)
  const { locating: locatingMyPosition, error: geoError, clearError: clearGeoError, requestPosition } =
    useGeolocation({ enableHighAccuracy: false, timeout: 7000, maximumAge: 120000 })

  const [reportPanelOpen, setReportPanelOpen] = useState(false)
  const [reportExpanded, setReportExpanded] = useState(false)
  const [billingNotice, setBillingNotice] = useState(null)
  const [billingEnabled, setBillingEnabled] = useState(false)
  const [checkoutPreview, setCheckoutPreview] = useState(null)
  const [mapInstance, setMapInstance] = useState(null)
  const handleGenerateRef = useRef(null)
  const resumeHandledRef = useRef(false)

  const [inputMode, setInputMode] = useState('single')
  const [scheduleRows, setScheduleRows] = useState([])
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)

  const {
    batchQuote,
    batchRun,
    loadingQuote: loadingBatchQuote,
    loadingRun: loadingBatchRun,
    quoteError: batchQuoteError,
    runError: batchRunError,
    checkoutPreview: batchCheckoutPreview,
    validLocationCount,
    requestBatchQuote,
    refreshCheckoutPreview,
    runBatch,
    clearBatch,
    markBatchQuotePending,
    setBatchQuote,
  } = usePropertyBatch()

  const scheduleMode = inputMode === 'schedule'
  const batchAddresses = useMemo(() => {
    if (batchQuote?.locations?.length) {
      return batchQuote.locations
        .filter(loc => loc.status === 'valid')
        .map(loc => loc.address_input)
    }
    return scheduleRows.map(row => row.address).filter(Boolean)
  }, [batchQuote, scheduleRows])

  const {

    catalog,

    selectedSources,

    toggleSource,

    toggleOptionalSource,

    applyPreset,

    activePresetId,

    quote,

    scheduleQuote,

    refreshQuote,

    record,

    loadingCatalog,

    loadingQuote,

    quoteError,

    loadingReport,

    error,

    presetNotice,

    clearPresetNotice,

    apiOnline,

    runReport,

    clearReport,

    clear,

    setSelectedSources,

  } = usePropertyReport()



  useEffect(() => {
    if (scheduleMode) return
    const quoteAddress = addressDraft.trim() || address.trim()
    scheduleQuote(quoteAddress, selectedSources)
  }, [scheduleMode, addressDraft, address, selectedSources, scheduleQuote])

  const handleToggleOptionalSource = useCallback(
    sourceId => {
      if (scheduleMode) {
        toggleSource(sourceId)
        return
      }
      const quoteAddress = addressDraft.trim() || address.trim()
      toggleOptionalSource(sourceId, quoteAddress)
    },
    [scheduleMode, toggleSource, addressDraft, address, toggleOptionalSource],
  )

  useEffect(() => {
    adoptAnonIdFromSearchParams(searchParams)
    const billing = searchParams.get('billing')
    const resume = searchParams.get('resume')
    if (billing === 'success') {
      const resumeData = loadBillingResume()
      window.dispatchEvent(new Event('axiom:billing-refresh'))

      if (resume === 'enrich' && resumeData?.address) {
        setAddressDraft(resumeData.address)
        setAddress(resumeData.address)
        if (resumeData.sourceUrls) setSourceUrls(resumeData.sourceUrls)
        setBillingNotice('Payment received. Generating your report…')
      } else if (resume === 'batch_enrich' && resumeData?.addresses?.length) {
        setInputMode('schedule')
        setScheduleRows(
          resumeData.addresses.map((addr, index) => ({
            rowIndex: index + 1,
            address: addr,
          })),
        )
        if (resumeData.batchQuoteSnapshot) setBatchQuote(resumeData.batchQuoteSnapshot)
        if (resumeData.selectedSources?.length) setSelectedSources(resumeData.selectedSources)
        setBillingNotice('Payment received. Analyzing your schedule…')
      } else if (resume === 'discover' && resumeData?.address) {
        setAddressDraft(resumeData.address)
        setAddress(resumeData.address)
        if (resumeData.sourceUrls) setSourceUrls(resumeData.sourceUrls)
        setBillingNotice('Payment received. Running AI preview…')
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('axiom:billing-resume-discover'))
        }, 400)
      } else {
        setBillingNotice('Payment received, credits added. You can run reports now.')
      }

      clearBillingResume()
      const next = new URLSearchParams(searchParams)
      next.delete('billing')
      next.delete('resume')
      next.delete('anon_id')
      setSearchParams(next, { replace: true })

      if (resume === 'enrich' && resumeData?.address && !resumeHandledRef.current) {
        resumeHandledRef.current = true
        window.setTimeout(() => {
          handleGenerateRef.current?.()
          resumeHandledRef.current = false
        }, 900)
      } else if (resume === 'batch_enrich' && resumeData?.addresses?.length && !resumeHandledRef.current) {
        resumeHandledRef.current = true
        window.setTimeout(async () => {
          setReportPanelOpen(true)
          try {
            let confirmedPrice =
              resumeData.confirmedPriceUsd ?? resumeData.batchQuoteSnapshot?.totals?.user_price_usd
            if (confirmedPrice == null && resumeData.selectedSources?.length) {
              const quoted = await requestBatchQuote(resumeData.addresses, resumeData.selectedSources)
              confirmedPrice = quoted?.totals?.user_price_usd
            }
            if (confirmedPrice != null) {
              await runBatch({
                addresses: resumeData.addresses,
                selectedSources: resumeData.selectedSources ?? [],
                confirmedPriceUsd: confirmedPrice,
              })
            }
          } catch {
            setBillingNotice('Payment received, but schedule analysis failed to start. Try again.')
          } finally {
            resumeHandledRef.current = false
          }
        }, 900)
      }
    } else if (billing === 'cancel') {
      setBillingNotice('Checkout canceled, no credits were added.')
      clearBillingResume()
      const next = new URLSearchParams(searchParams)
      next.delete('billing')
      next.delete('resume')
      next.delete('anon_id')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, setBatchQuote, setSelectedSources, requestBatchQuote, runBatch])

  useEffect(() => {
    if (!apiOnline) {
      setBillingEnabled(false)
      return undefined
    }
    let cancelled = false
    fetchBillingPacks()
      .then(data => {
        if (!cancelled) setBillingEnabled(Boolean(data.billing_enabled))
      })
      .catch(() => {
        if (!cancelled) setBillingEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiOnline])

  const paymentNotice =
    billingEnabled && checkoutPreview && !checkoutPreview.sufficient
      ? `Scan with your phone or continue on this computer to pay ${formatUsd(checkoutPreview.charge_usd)}.`
      : billingEnabled
        ? 'Add credits below the title, then try again.'
        : 'Dry run, wallet billing not configured on the server.'

  const activeAddress = addressDraft.trim() || address.trim()

  const markAddressComposing = useCallback(() => {
    setAddressComposing(true)
    if (composeTimerRef.current) clearTimeout(composeTimerRef.current)
    composeTimerRef.current = setTimeout(() => {
      setAddressComposing(false)
    }, 800)
  }, [])

  const clearAddressComposing = useCallback(() => {
    if (composeTimerRef.current) clearTimeout(composeTimerRef.current)
    composeTimerRef.current = null
    setAddressComposing(false)
  }, [])

  const applyMapLocation = useCallback((coords, label, { immediate = false } = {}) => {
    const pair = normalizeLatLng(coords)
    if (!pair) return false
    setMapView({
      lat: pair.lat,
      lng: pair.lng,
      label: label ?? activeAddress,
      immediate,
      locked: true,
    })
    return true
  }, [activeAddress])

  useEffect(
    () => () => {
      if (composeTimerRef.current) clearTimeout(composeTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    const q = addressDraft.trim()
    if (!q) {
      if (address) setAddress('')
      return undefined
    }

    const timer = setTimeout(() => {
      setAddress(q)
    }, 350)

    return () => clearTimeout(timer)
  }, [addressDraft, address])



  const handleClear = useCallback(() => {

    setAddressDraft('')
    setAddress('')

    setSourceUrls({})

    setMapView(null)

    setResolvingAddress(false)
    setLocationError('')
    setAddressSearching(false)
    setLocateSuccess(false)
    setGeolocateCommitting(false)
    clearGeoError()
    setReportPanelOpen(false)
    clearAddressComposing()

    clear()
    clearBatch()
    setInputMode('single')
    setScheduleRows([])
    setScheduleModalOpen(false)

  }, [clear, clearAddressComposing, clearBatch])



  const handleAddressChange = useCallback(value => {
    setAddressDraft(value)
    setLocationError('')
    clearGeoError()
    setLocateSuccess(false)
    markAddressComposing()
    setMapView(prev => {
      const coords = normalizeLatLng(prev)
      if (coords && prev?.locked) {
        return {
          lat: prev.lat,
          lng: prev.lng,
          label: prev.label,
          locked: false,
          immediate: false,
        }
      }
      return null
    })
    setReportPanelOpen(false)
    clearReport()
  }, [markAddressComposing, clearReport, clearGeoError])



  const handleAddressSelect = useCallback(selection => {
    const coords = normalizeLatLng(selection)
    if (!coords) return
    clearAddressComposing()
    clearReport()
    setReportPanelOpen(false)
    const label = selection?.label ?? activeAddress
    if (label) {
      setAddressDraft(label)
      setAddress(label)
    }
    applyMapLocation(coords, label, { immediate: true })
  }, [activeAddress, clearAddressComposing, clearReport, applyMapLocation])



  const handleMyLocation = useCallback(async () => {
    if (locatingMyPosition || loadingReport || geolocateCommitting) return

    setLocationError('')
    clearGeoError()
    setLocateSuccess(false)
    clearAddressComposing()
    clearReport()
    setReportPanelOpen(false)
    setGeolocateCommitting(true)
    setResolvingAddress(true)

    try {
      const pos = await requestPosition({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      })
      const coords = normalizeLatLng(pos)
      if (!coords) throw new Error('Invalid coordinates')

      if (!inBbox(coords.lat, coords.lng, SEISMIC_COUNTRY_BBOX.US)) {
        setLocationError('Your location is outside the United States.')
        return
      }

      setMapView({
        lat: coords.lat,
        lng: coords.lng,
        label: '',
        immediate: true,
        locked: false,
      })

      const resolved = await resolveUsLocationFromCoords(coords.lat, coords.lng, {
        bbox: SEISMIC_COUNTRY_BBOX.US,
      })

      const selection =
        normalizeSuggestion(resolved) ??
        normalizeSuggestion({
          id: `geo-${coords.lat}-${coords.lng}`,
          label: `Current location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
          lat: coords.lat,
          lng: coords.lng,
        })

      handleAddressSelect(selection)
      setLocateSuccess(true)
      window.setTimeout(() => setLocateSuccess(false), 2400)
    } catch (err) {
      setLocationError(
        err?.message || 'Unable to access your location. Allow browser location access and try again.',
      )
    } finally {
      setResolvingAddress(false)
      setGeolocateCommitting(false)
    }
  }, [
    locatingMyPosition,
    loadingReport,
    geolocateCommitting,
    clearAddressComposing,
    clearReport,
    requestPosition,
    clearGeoError,
    handleAddressSelect,
  ])

  const startEnrichCheckout = useCallback(
    (previewHint = null) => {
      if (!activeAddress || !quote?.totals) return false
      const preview = previewHint ?? checkoutPreview
      presentCheckout({
        title: 'Generate intelligence report',
        charge_usd: preview?.charge_usd ?? quote.totals.user_price_usd,
        credits_to_add: preview?.credits_to_add,
        fetchPreview:
          preview?.credits_to_add != null
            ? undefined
            : () =>
                fetchCheckoutPreview({
                  purpose: 'enrich',
                  address: activeAddress,
                  selectedSources,
                }),
        fetchSession: embedded =>
          startQuoteCheckout({
            purpose: 'enrich',
            address: activeAddress,
            selectedSources,
            confirmedPriceUsd: quote.totals.user_price_usd,
            resumeContext: {
              address: activeAddress,
              selectedSources,
              sourceUrls,
            },
            embedded,
          }),
        onComplete: () => {
          setBillingNotice('Payment received. Generating your report…')
          setReportPanelOpen(true)
          handleGenerateRef.current?.()
        },
      })
      return true
    },
    [activeAddress, quote, selectedSources, sourceUrls, checkoutPreview, presentCheckout],
  )

  const startBatchCheckout = useCallback(
    (previewHint = null) => {
      if (!batchQuote?.totals || !batchAddresses.length) return false
      const preview = previewHint ?? batchCheckoutPreview
      presentCheckout({
        title: 'Analyze schedule',
        charge_usd: preview?.charge_usd ?? batchQuote.totals.user_price_usd,
        credits_to_add: preview?.credits_to_add,
        fetchPreview:
          preview?.credits_to_add != null
            ? undefined
            : () =>
                fetchBatchCheckoutPreview({
                  addresses: batchAddresses,
                  selectedSources,
                }),
        fetchSession: embedded =>
          startQuoteCheckout({
            purpose: 'batch_enrich',
            address: batchAddresses[0] ?? '',
            addresses: batchAddresses,
            selectedSources,
            confirmedPriceUsd: batchQuote.totals.user_price_usd,
            resumeContext: {
              mode: 'batch',
              addresses: batchAddresses,
              selectedSources,
              confirmedPriceUsd: batchQuote.totals.user_price_usd,
              batchQuoteSnapshot: batchQuote,
            },
            embedded,
          }),
        onComplete: () => {
          setBillingNotice('Payment received. Analyzing your schedule…')
          setReportPanelOpen(true)
          handleGenerateRef.current?.()
        },
      })
      return true
    },
    [batchQuote, batchAddresses, selectedSources, batchCheckoutPreview, presentCheckout],
  )

  const resolveCheckoutPreview = useCallback(async () => {
    if (!billingEnabled || !apiOnline) return null
    if (scheduleMode) {
      if (!batchAddresses.length || !selectedSources.length) return null
      return refreshCheckoutPreview(batchAddresses, selectedSources)
    }
    if (!activeAddress || !selectedSources.length || !quote?.totals) return null
    try {
      const preview = await fetchCheckoutPreview({
        purpose: 'enrich',
        address: activeAddress,
        selectedSources,
      })
      setCheckoutPreview(preview)
      return preview
    } catch {
      return null
    }
  }, [
    billingEnabled,
    apiOnline,
    scheduleMode,
    batchAddresses,
    selectedSources,
    refreshCheckoutPreview,
    activeAddress,
    quote,
  ])

  const handleGenerate = useCallback(async () => {
    if (scheduleMode) {
      if (!batchQuote?.totals || !batchAddresses.length) return
      if (billingEnabled) {
        const preview = batchCheckoutPreview ?? (await resolveCheckoutPreview())
        if (preview && !preview.sufficient && preview.charge_usd > 0) {
          startBatchCheckout(preview)
          return
        }
      }
      setReportPanelOpen(true)
      try {
        await runBatch({
          addresses: batchAddresses,
          selectedSources,
          confirmedPriceUsd: batchQuote.totals.user_price_usd,
        })
      } catch (err) {
        if (billingEnabled && isPaymentRequiredError(err)) {
          startBatchCheckout()
        }
      }
      return
    }

    const runAddress = activeAddress
    if (!runAddress || !quote?.totals) return

    if (billingEnabled) {
      const preview = checkoutPreview ?? (await resolveCheckoutPreview())
      if (preview && !preview.sufficient && preview.charge_usd > 0) {
        startEnrichCheckout(preview)
        return
      }
    }

    setReportPanelOpen(true)
    try {
      await runReport({ address: runAddress, sourceUrls })
    } catch (err) {
      if (billingEnabled && isPaymentRequiredError(err)) {
        startEnrichCheckout()
      }
    }
  }, [
    scheduleMode,
    batchQuote,
    batchAddresses,
    selectedSources,
    billingEnabled,
    batchCheckoutPreview,
    checkoutPreview,
    resolveCheckoutPreview,
    startBatchCheckout,
    runBatch,
    activeAddress,
    quote,
    startEnrichCheckout,
    runReport,
    sourceUrls,
  ])

  handleGenerateRef.current = handleGenerate



  const scheduleReady = scheduleMode && validLocationCount >= 1 && Boolean(batchQuote?.totals)
  const activeCheckoutPreview = scheduleMode ? batchCheckoutPreview : checkoutPreview

  const handleInputModeChange = useCallback(
    mode => {
      setInputMode(mode)
      if (mode === 'single') {
        clearBatch()
        setScheduleRows([])
        setScheduleModalOpen(false)
      } else {
        clearReport()
        setReportPanelOpen(false)
      }
    },
    [clearBatch, clearReport],
  )

  const handleScheduleRowsChange = useCallback(
    rows => {
      setScheduleRows(rows)
      setBatchQuote(null)
    },
    [setBatchQuote],
  )

  useEffect(() => {
    if (!scheduleMode || !activePresetId) return undefined
    const addresses = scheduleRows.map(row => row.address).filter(Boolean)
    if (!addresses.length || !selectedSources.length) return undefined

    markBatchQuotePending()
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const data = await requestBatchQuote(addresses, selectedSources)
        if (cancelled) return
        const firstValid = data.locations?.find(loc => loc.status === 'valid' && loc.lat && loc.lng)
        if (firstValid) {
          setMapView({
            lat: firstValid.lat,
            lng: firstValid.lng,
            label: firstValid.display_name ?? firstValid.address_input,
            immediate: true,
            locked: false,
          })
        }
      } catch {
        /* surfaced in hook */
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    scheduleMode,
    activePresetId,
    scheduleRows,
    selectedSources,
    requestBatchQuote,
    markBatchQuotePending,
  ])

  const handlePreviewScheduleLocation = useCallback(loc => {
    if (!loc?.lat || !loc?.lng) return
    setMapView({
      lat: loc.lat,
      lng: loc.lng,
      label: loc.display_name ?? loc.address_input,
      immediate: true,
      locked: false,
    })
  }, [])

  const recordCoords = normalizeLatLng(record)
  const mapViewCoords = normalizeLatLng(mapView)
  const recordMatchesAddress = Boolean(
    record &&
      activeAddress &&
      [record.address_input, record.display_name]
        .filter(Boolean)
        .some(
          value => value.trim().toLowerCase() === activeAddress.trim().toLowerCase(),
        ),
  )
  const mapCoords = mapViewCoords ?? (recordMatchesAddress ? recordCoords : null)
  const hasCoords = Boolean(mapCoords)

  const locationLocked = Boolean(
    activeAddress && mapViewCoords && mapView?.locked && !addressComposing,
  )

  useEffect(() => {
    if (!locationLocked || !activeAddress || !selectedSources.length || loadingQuote) return
    if (quote?.totals && sourcesMatchQuote(selectedSources, quote.selected_sources, catalog)) return
    refreshQuote(activeAddress, selectedSources)
  }, [
    locationLocked,
    activeAddress,
    selectedSources,
    loadingQuote,
    quote,
    catalog,
    refreshQuote,
  ])

  const locationPhase = useMemo(() => {
    if (locationError || geoError) return 'error'
    if (locationLocked) return 'locked'
    if (locatingMyPosition) return 'locating'
    if (geolocateCommitting || (resolvingAddress && !addressComposing)) return 'resolving'
    if (addressSearching && addressComposing) return 'searching'
    if (addressComposing && activeAddress) return 'composing'
    if (!activeAddress) return 'idle'
    return 'idle'
  }, [
    locationError,
    geoError,
    locationLocked,
    locatingMyPosition,
    geolocateCommitting,
    resolvingAddress,
    addressComposing,
    addressSearching,
    activeAddress,
  ])

  const mapFlyDelay = useMemo(() => {
    if (mapView?.immediate) return 0
    if (locationPhase === 'resolving') return 250
    return 350
  }, [mapView?.immediate, locationPhase])

  const hasReport = Boolean(record)

  const requiredUrlIds = sourcesNeedingUrlIds(catalog, selectedSources)

  const quoteSynced =
    !quote ||
    !selectedSources.length ||
    sourcesMatchQuote(selectedSources, quote.selected_sources, catalog)

  const generateBlockReason = useMemo(() => {
    if (scheduleMode) {
      if (!scheduleRows.length) return 'Upload a schedule with at least one address.'
      if (!activePresetId) return 'Choose a package to validate and price your schedule.'
      if (selectedSources.length === 0) return 'Choose a package or at least one source.'
      if (loadingBatchQuote) return null
      if (batchQuoteError) return batchQuoteError
      if (!batchQuote?.totals) return 'Waiting for schedule estimate…'
      if (validLocationCount === 0) return 'No valid locations in schedule.'
      return null
    }
    if (!activeAddress) return 'Add a property address to generate.'
    if (selectedSources.length === 0) return 'Choose a package or at least one source.'
    if (!locationLocked) return 'Pick an address from suggestions or press Enter to lock the map.'
    if (loadingQuote) return null
    if (quoteError) return quoteError
    if (!quote?.totals) return 'Waiting for estimate…'
    if (!quoteSynced) return 'Updating estimate for selected sources…'
    return null
  }, [
    scheduleMode,
    scheduleRows.length,
    activePresetId,
    activeAddress,
    selectedSources.length,
    loadingQuote,
    loadingBatchQuote,
    quoteSynced,
    quoteError,
    batchQuoteError,
    locationLocked,
    quote?.totals,
    batchQuote?.totals,
    validLocationCount,
  ])

  useEffect(() => {
    if (scheduleMode) return undefined
    if (!billingEnabled || !apiOnline || !locationLocked || !activeAddress || !selectedSources.length) {
      setCheckoutPreview(null)
      return undefined
    }
    if (!quoteSynced || !quote?.totals) {
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      fetchCheckoutPreview({
        purpose: 'enrich',
        address: activeAddress,
        selectedSources,
      })
        .then(data => {
          if (!cancelled) setCheckoutPreview(data)
        })
        .catch(() => {
          if (!cancelled) setCheckoutPreview(null)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    scheduleMode,
    billingEnabled,
    apiOnline,
    locationLocked,
    activeAddress,
    selectedSources,
    quoteSynced,
    quote?.totals?.user_price_usd,
  ])

  useEffect(() => {
    if (!scheduleMode || !billingEnabled || !apiOnline || !scheduleReady || !selectedSources.length) {
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      refreshCheckoutPreview(batchAddresses, selectedSources).catch(() => {})
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    scheduleMode,
    billingEnabled,
    apiOnline,
    scheduleReady,
    selectedSources,
    batchAddresses,
    batchQuote?.totals?.user_price_usd,
    refreshCheckoutPreview,
  ])

  useEffect(() => {
    if (record) {
      setReportPanelOpen(true)
      setReportExpanded(true)
    }
  }, [record])

  useEffect(() => {
    if (batchRun) {
      setReportPanelOpen(true)
      setReportExpanded(true)
    }
  }, [batchRun])

  const hasBatchReport = Boolean(batchRun)
  const showReportPanel =
    reportPanelOpen &&
    (loadingReport ||
      Boolean(record) ||
      Boolean(error) ||
      (scheduleMode && (loadingBatchRun || Boolean(batchRun) || Boolean(batchRunError))))

  const displayQuote = record?.receipt

    ? {

        ...quote,

        line_items: record.receipt.line_items,

        totals: record.receipt.totals,

        report_id: record.receipt.report_id,

        warnings: record.warnings,

        isFinal: true,

        note: record.receipt.totals?.note,

      }

    : quote



  const mapLat = mapCoords?.lat ?? null
  const mapLng = mapCoords?.lng ?? null

  const displayLabel =
    mapView?.label ??
    (recordMatchesAddress ? record?.display_name : null) ??
    addressDraft



  return (

    <div className="flex h-[100dvh] flex-col overflow-hidden">

      <PropertyHeader apiOnline={apiOnline} />



      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <PropertyWorkflowHud
          inputMode={inputMode}
          onInputModeChange={handleInputModeChange}
          scheduleReady={scheduleReady}
          scheduleMode={scheduleMode}
          scheduleRows={scheduleRows}
          batchQuote={batchQuote}
          onOpenSchedule={() => setScheduleModalOpen(true)}
          onPreviewScheduleLocation={handlePreviewScheduleLocation}
          locationLocked={locationLocked}
          locationPhase={locationPhase}
          address={addressDraft}
          loadingReport={loadingReport || loadingBatchRun}
          locationError={locationError || geoError}
          locateSuccess={locateSuccess}
          geolocateCommitting={geolocateCommitting}
          onAddressChange={handleAddressChange}
          onAddressSelect={handleAddressSelect}
          onMyLocation={handleMyLocation}
          onClear={handleClear}
          onSearchingChange={setAddressSearching}
          presets={catalog?.presets}
          catalog={catalog}
          activePresetId={activePresetId}
          selectedSources={selectedSources}
          quote={quote}
          loadingQuote={scheduleMode ? loadingBatchQuote : loadingQuote || (!quoteSynced && Boolean(displayQuote))}
          onToggleSource={handleToggleOptionalSource}
          onApply={applyPreset}
          disabled={loadingReport || loadingCatalog || loadingBatchRun}
          apiOnline={apiOnline}
          requiredUrlIds={requiredUrlIds}
          sourceUrls={sourceUrls}
          onSourceUrlsChange={setSourceUrls}
          onPaymentRequired={() => setBillingNotice(paymentNotice)}
          onGenerate={handleGenerate}
          billingEnabled={billingEnabled}
          checkoutPreview={activeCheckoutPreview}
          generateDisabled={Boolean(generateBlockReason)}
          generateBlockReason={generateBlockReason}
          hasReport={hasReport}
          hasBatchReport={hasBatchReport}
          enrichStatus={record?.status}
          billingNotice={billingNotice}
          onDismissBillingNotice={() => setBillingNotice(null)}
          presetNotice={presetNotice}
          onDismissPresetNotice={clearPresetNotice}
          quoteSynced={quoteSynced}
          displayQuote={displayQuote}
          quoteError={scheduleMode ? batchQuoteError : quoteError}
        />

        <div
          className={`relative min-w-0 ${
            showReportPanel
              ? reportExpanded
                ? 'hidden'
                : 'h-[30vh] shrink-0 lg:h-auto lg:min-h-0 lg:flex-[1]'
              : 'min-h-[42vh] flex-1 lg:min-h-0'
          }`}
        >
          <PropertyMap
            lat={mapLat}
            lng={mapLng}
            label={displayLabel}
            flyDelay={mapFlyDelay}
            showPlaceholder={false}
            locationLocked={Boolean(mapCoords) && (locationLocked || scheduleMode)}
            locationPhase={mapCoords ? (scheduleMode || locationLocked ? 'locked' : locationPhase) : locationPhase}
            onMapReady={setMapInstance}
          />
        </div>

        {showReportPanel ? (
          <aside
            className={`flex min-h-0 w-full flex-col border-t border-panel-border bg-panel-bg lg:border-l lg:border-t-0 ${
              reportExpanded
                ? 'min-h-0 flex-1'
                : 'min-h-0 flex-1 lg:w-[min(40rem,46vw)] lg:min-w-[30rem] lg:max-w-[680px] lg:flex-none'
            }`}
          >
            {scheduleMode && (batchRun || loadingBatchRun || batchRunError) ? (
              <BatchResultsPanel
                batchRun={batchRun}
                loading={loadingBatchRun}
                error={batchRunError}
                apiOnline={apiOnline}
                expanded={reportExpanded}
                onToggleExpand={() => setReportExpanded(expanded => !expanded)}
                onClose={() => {
                  setReportPanelOpen(false)
                  setReportExpanded(false)
                }}
              />
            ) : (
              <ReportResultsPanel
                variant="panel"
                record={record}
                error={error}
                loading={loadingReport}
                apiOnline={apiOnline}
                expanded={reportExpanded}
                onToggleExpand={() => setReportExpanded(expanded => !expanded)}
                onClose={() => {
                  setReportPanelOpen(false)
                  setReportExpanded(false)
                }}
              />
            )}
          </aside>
        ) : null}

      </main>

      <ScheduleUploadModal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        rows={scheduleRows}
        onRowsChange={handleScheduleRowsChange}
      />

    </div>

  )

}

