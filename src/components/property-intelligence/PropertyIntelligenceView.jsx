import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { SEISMIC_COUNTRY_BBOX } from '../../data/commandMapData'

import { reverseGeocodeUs, inBbox } from '../../services/geocode'
import { normalizeLatLng } from '../../utils/coords'
import { sourcesNeedingUrlIds, fetchBillingPacks, sourcesMatchQuote } from '../../services/propertyApi'

import usePropertyReport from '../../hooks/usePropertyReport'
import useGeolocation from '../../hooks/useGeolocation'

import PropertyHeader from './PropertyHeader'

import PropertyMap from './PropertyMap'

import PropertyWorkflowHud from './PropertyWorkflowHud'

import ReportResultsPanel from './ReportResultsPanel'

export default function PropertyIntelligenceView() {

  const [addressDraft, setAddressDraft] = useState('')
  const [address, setAddress] = useState('')

  const [sourceUrls, setSourceUrls] = useState({})

  const [mapView, setMapView] = useState(null)

  const [resolvingAddress, setResolvingAddress] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [addressSearching, setAddressSearching] = useState(false)
  const [locateSuccess, setLocateSuccess] = useState(false)
  const composeTimerRef = useRef(null)
  const [addressComposing, setAddressComposing] = useState(false)
  const { locating: locatingMyPosition, error: geoError, clearError: clearGeoError, requestPosition } =
    useGeolocation()

  const [reportPanelOpen, setReportPanelOpen] = useState(false)
  const [billingNotice, setBillingNotice] = useState(null)
  const [billingEnabled, setBillingEnabled] = useState(false)
  const [mapInstance, setMapInstance] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const {

    catalog,

    selectedSources,

    toggleSource,

    toggleOptionalSource,

    applyPreset,

    activePresetId,

    quote,

    scheduleQuote,

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

  } = usePropertyReport()



  useEffect(() => {
    const quoteAddress = addressDraft.trim() || address.trim()
    scheduleQuote(quoteAddress, selectedSources)
  }, [addressDraft, address, selectedSources, scheduleQuote])

  const handleToggleOptionalSource = useCallback(
    sourceId => {
      const quoteAddress = addressDraft.trim() || address.trim()
      toggleOptionalSource(sourceId, quoteAddress)
    },
    [addressDraft, address, toggleOptionalSource],
  )

  useEffect(() => {
    const billing = searchParams.get('billing')
    if (billing === 'success') {
      setBillingNotice('Payment received, credits added. You can run reports now.')
      window.dispatchEvent(new Event('axiom:billing-refresh'))
      const next = new URLSearchParams(searchParams)
      next.delete('billing')
      setSearchParams(next, { replace: true })
    } else if (billing === 'cancel') {
      setBillingNotice('Checkout canceled, no credits were added.')
      const next = new URLSearchParams(searchParams)
      next.delete('billing')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

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

  const paymentNotice = billingEnabled
    ? 'Add credits using the Credits button in the header, then try again.'
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
    setResolvingAddress(false)
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
    clearGeoError()
    setReportPanelOpen(false)
    clearAddressComposing()

    clear()

  }, [clear, clearAddressComposing])



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
    if (locatingMyPosition || loadingReport) return

    setLocationError('')
    clearGeoError()
    setLocateSuccess(false)

    try {
      const pos = await requestPosition()
      const coords = normalizeLatLng(pos)
      if (!coords) throw new Error('Invalid coordinates')

      if (!inBbox(coords.lat, coords.lng, SEISMIC_COUNTRY_BBOX.US)) {
        setLocationError('Your location is outside the United States.')
        return
      }

      setResolvingAddress(true)
      const reversed = await reverseGeocodeUs(coords.lat, coords.lng, {
        bbox: SEISMIC_COUNTRY_BBOX.US,
      })
      const finalCoords = normalizeLatLng(reversed) ?? coords
      const label =
        reversed?.label ??
        `Current location (${finalCoords.lat.toFixed(4)}, ${finalCoords.lng.toFixed(4)})`

      setAddressDraft(label)
      setAddress(label)
      clearAddressComposing()
      setMapView({
        lat: finalCoords.lat,
        lng: finalCoords.lng,
        label,
        immediate: true,
        locked: true,
      })
      setResolvingAddress(false)
      setLocateSuccess(true)
      window.setTimeout(() => setLocateSuccess(false), 2400)
    } catch (err) {
      setLocationError(
        err?.message || 'Unable to access your location. Allow browser location access and try again.',
      )
      setResolvingAddress(false)
    }
  }, [locatingMyPosition, loadingReport, clearAddressComposing, requestPosition, clearGeoError])

  const handleGenerate = useCallback(async () => {
    const runAddress = activeAddress
    if (!runAddress) return

    setReportPanelOpen(true)
    try {
      await runReport({ address: runAddress, sourceUrls })
    } catch {
      /* surfaced in hook */
    }
  }, [activeAddress, sourceUrls, runReport])



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

  const locationPhase = useMemo(() => {
    if (locationError || geoError) return 'error'
    if (locationLocked) return 'locked'
    if (locatingMyPosition) return 'locating'
    if (resolvingAddress && !addressComposing) return 'resolving'
    if (addressSearching && addressComposing) return 'searching'
    if (addressComposing && activeAddress) return 'composing'
    if (!activeAddress) return 'idle'
    return 'idle'
  }, [
    locationError,
    geoError,
    locationLocked,
    locatingMyPosition,
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
    sourcesMatchQuote(selectedSources, quote.selected_sources)

  const generateBlockReason = useMemo(() => {
    if (!activeAddress) return 'Add a property address to generate.'
    if (selectedSources.length === 0) return 'Choose a package or at least one source.'
    if (loadingQuote) return 'Calculating estimate…'
    if (!quoteSynced) return 'Updating estimate for selected sources…'
    if (quoteError) return quoteError
    if (!locationLocked) return 'Pick an address from suggestions or press Enter to lock the map.'
    return null
  }, [
    activeAddress,
    selectedSources.length,
    loadingQuote,
    quoteSynced,
    quoteError,
    locationLocked,
  ])

  useEffect(() => {
    if (record) setReportPanelOpen(true)
  }, [record])


  const showReportPanel = reportPanelOpen && (loadingReport || Boolean(record) || Boolean(error))



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
          locationLocked={locationLocked}
          locationPhase={locationPhase}
          address={addressDraft}
          loadingReport={loadingReport}
          locationError={locationError || geoError}
          locateSuccess={locateSuccess}
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
          loadingQuote={loadingQuote || (!quoteSynced && Boolean(displayQuote))}
          onToggleSource={handleToggleOptionalSource}
          onApply={applyPreset}
          onToggleCatalogSource={toggleSource}
          disabled={loadingReport || loadingCatalog}
          apiOnline={apiOnline}
          requiredUrlIds={requiredUrlIds}
          sourceUrls={sourceUrls}
          onSourceUrlsChange={setSourceUrls}
          onPaymentRequired={() => setBillingNotice(paymentNotice)}
          onGenerate={handleGenerate}
          generateDisabled={Boolean(generateBlockReason)}
          generateBlockReason={generateBlockReason}
          hasReport={hasReport}
          enrichStatus={record?.status}
          billingNotice={billingNotice}
          onDismissBillingNotice={() => setBillingNotice(null)}
          presetNotice={presetNotice}
          onDismissPresetNotice={clearPresetNotice}
          quoteSynced={quoteSynced}
          displayQuote={displayQuote}
          quoteError={quoteError}
        />

        <div
          className={`relative min-h-[42vh] min-w-0 flex-1 lg:min-h-0 ${
            showReportPanel ? 'lg:flex-[1.15]' : ''
          }`}
        >
          <PropertyMap
            lat={mapLat}
            lng={mapLng}
            label={displayLabel}
            flyDelay={mapFlyDelay}
            showPlaceholder={false}
            locationLocked={locationLocked}
            locationPhase={locationPhase}
            onMapReady={setMapInstance}
          />
        </div>

        {showReportPanel ? (
          <aside className="flex min-h-[280px] w-full shrink-0 flex-col border-t border-panel-border bg-panel-bg lg:min-h-0 lg:w-[min(28rem,34vw)] lg:max-w-[480px] lg:border-l lg:border-t-0">
            <ReportResultsPanel
              variant="panel"
              record={record}
              error={error}
              loading={loadingReport}
              apiOnline={apiOnline}
            />
          </aside>
        ) : null}

      </main>

    </div>

  )

}

