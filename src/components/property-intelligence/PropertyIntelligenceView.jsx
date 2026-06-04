import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { SEISMIC_COUNTRY_BBOX } from '../../data/commandMapData'

import { resolveUsAddressCoords } from '../../services/geocode'
import { normalizeLatLng } from '../../utils/coords'
import { sourcesNeedingUrlIds } from '../../services/propertyApi'

import usePropertyReport from '../../hooks/usePropertyReport'

import IntentPackagePicker from './IntentPackagePicker'

import LiveReceipt from './LiveReceipt'

import AdvancedDrawer from './AdvancedDrawer'

import PropertyHeader from './PropertyHeader'

import PropertyMap from './PropertyMap'

import PropertySearchBar from './PropertySearchBar'

import PublicSourcePanel from './PublicSourcePanel'

import MapSourceDiscoveryHud from './MapSourceDiscoveryHud'

import ReportResultsPanel from './ReportResultsPanel'

import SourceCatalogPanel from './SourceCatalogPanel'



export default function PropertyIntelligenceView() {

  const [addressDraft, setAddressDraft] = useState('')
  const [address, setAddress] = useState('')

  const [sourceUrls, setSourceUrls] = useState({})

  const [mapView, setMapView] = useState(null)

  const [resolvingAddress, setResolvingAddress] = useState(false)
  const resolveControllerRef = useRef(null)

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [billingNotice, setBillingNotice] = useState(null)
  const [mapInstance, setMapInstance] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()



  const {

    catalog,

    selectedSources,

    toggleSource,

    applyPreset,

    activePresetId,

    quote,

    scheduleQuote,

    record,

    loadingCatalog,

    loadingQuote,

    loadingReport,

    error,

    presetNotice,

    clearPresetNotice,

    apiOnline,

    runReport,

    clear,

  } = usePropertyReport()



  useEffect(() => {
    scheduleQuote(address, selectedSources)
  }, [address, selectedSources, scheduleQuote])

  useEffect(() => {
    const billing = searchParams.get('billing')
    if (billing === 'success') {
      setBillingNotice('Payment received — credits added. You can run reports now.')
      window.dispatchEvent(new Event('axiom:billing-refresh'))
      const next = new URLSearchParams(searchParams)
      next.delete('billing')
      setSearchParams(next, { replace: true })
    } else if (billing === 'cancel') {
      setBillingNotice('Checkout canceled — no credits were added.')
      const next = new URLSearchParams(searchParams)
      next.delete('billing')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Server quote includes geocoded coordinates — update map as soon as quote matches address.
  useEffect(() => {
    if (!address.trim()) return
    if (quote?.address_input?.trim() !== address.trim()) return
    const coords = normalizeLatLng(quote)
    if (!coords) return
    setMapView(prev => ({
      lat: coords.lat,
      lng: coords.lng,
      label: quote?.display_name ?? address,
      immediate: false,
      locked: true,
    }))
    setResolvingAddress(false)
  }, [address, quote])

  useEffect(() => {
    const q = addressDraft.trim()
    if (!q) {
      if (address) setAddress('')
      return undefined
    }

    // Patient commit: only geocode/quote once the user pauses typing.
    const timer = setTimeout(() => {
      setAddress(q)
    }, 1400)

    return () => clearTimeout(timer)
  }, [addressDraft, address])



  const handleClear = useCallback(() => {

    setAddressDraft('')
    setAddress('')

    setSourceUrls({})

    setMapView(null)

    setResolvingAddress(false)

    clear()

  }, [clear])



  const handleAddressChange = useCallback(value => {

    setAddressDraft(value)

    setMapView(prev => (prev?.locked ? { ...prev, locked: false } : prev))

  }, [])



  const handleAddressSelect = useCallback(selection => {
    const coords = normalizeLatLng(selection)
    if (!coords) return
    if (selection?.label) {
      setAddressDraft(selection.label)
      setAddress(selection.label)
    }
    setResolvingAddress(false)
    setMapView({
      lat: coords.lat,
      lng: coords.lng,
      label: selection?.label ?? address,
      immediate: true,
      locked: true,
    })
  }, [address])



  useEffect(() => {
    const trimmed = address.trim()
    const mapCoords = normalizeLatLng(mapView)

    if (!trimmed) {
      resolveControllerRef.current?.abort?.()
      resolveControllerRef.current = null
      setResolvingAddress(false)
      if (!record) setMapView(null)
      return undefined
    }

    // If we already have a locked coordinate for the current address, stop resolving.
    if (mapView?.locked && mapCoords) {
      setResolvingAddress(false)
      return undefined
    }

    // Cancel any in-flight resolve when address changes.
    resolveControllerRef.current?.abort?.()
    const controller = new AbortController()
    resolveControllerRef.current = controller

    // Patient resolve: avoid flicker and only resolve if quote didn't already provide coords.
    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return

      if (quote?.address_input?.trim() === trimmed && normalizeLatLng(quote)) {
        setResolvingAddress(false)
        return
      }

      setResolvingAddress(true)

      try {
        const resolved = await resolveUsAddressCoords(trimmed, {
          countryId: 'US',
          bbox: SEISMIC_COUNTRY_BBOX.US,
          signal: controller.signal,
        })
        const coords = normalizeLatLng(resolved)
        if (controller.signal.aborted) return

        setResolvingAddress(false)
        if (!coords) return

        const resolvedLabel = resolved?.label ?? trimmed
        setMapView({
          lat: coords.lat,
          lng: coords.lng,
          label: resolvedLabel,
          immediate: false,
          locked: true,
        })

        // Snap the input to the resolved canonical label once (prevents repeated re-searching).
        if (resolvedLabel && resolvedLabel !== addressDraft.trim()) {
          setAddressDraft(resolvedLabel)
        }
        if (resolvedLabel && resolvedLabel !== trimmed) {
          setAddress(resolvedLabel)
        }
      } catch (err) {
        if (err?.name === 'AbortError') return
        setResolvingAddress(false)
      }
    }, 1200)

    return () => {
      clearTimeout(timer)
      controller.abort()
      if (resolveControllerRef.current === controller) {
        resolveControllerRef.current = null
      }
    }
  }, [address, addressDraft, mapView, quote, record])



  const handleGenerate = useCallback(async () => {

    if (!address.trim()) return

    try {

      await runReport({ address, sourceUrls })

    } catch {

      /* surfaced in hook */

    }

  }, [address, sourceUrls, runReport])



  const recordCoords = normalizeLatLng(record)
  const mapViewCoords = normalizeLatLng(mapView)
  const hasCoords = Boolean(recordCoords || mapViewCoords)

  const locationLocked = Boolean(
    address.trim() && hasCoords && (mapView?.locked || recordCoords),
  )

  const hasReport = Boolean(record)

  const requiredUrlIds = sourcesNeedingUrlIds(catalog, selectedSources)
  const missingRequiredUrls = requiredUrlIds.filter(id => !(sourceUrls?.[id] ?? '').trim())

  const advancedBadges = [
    missingRequiredUrls.length > 0
      ? {
          label: `Needs ${missingRequiredUrls.length} URL${missingRequiredUrls.length === 1 ? '' : 's'}`,
          tone: 'warning',
        }
      : null,
    selectedSources.length > 0 ? { label: `${selectedSources.length} sources`, tone: 'neutral' } : null,
    record ? { label: 'Report ready', tone: 'stable' } : null,
  ].filter(Boolean)

  useEffect(() => {
    if (missingRequiredUrls.length === 0) return
    const wide = window.matchMedia('(min-width: 1024px)')
    if (!wide.matches) setAdvancedOpen(true)
  }, [missingRequiredUrls.length])

  useEffect(() => {
    if (record) setAdvancedOpen(false)
  }, [record])



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



  const mapCoords = recordCoords ?? mapViewCoords
  const mapLat = mapCoords?.lat ?? null
  const mapLng = mapCoords?.lng ?? null

  const displayLabel = record?.display_name ?? mapView?.label ?? addressDraft



  return (

    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-ink-primary">

      <PropertyHeader

        apiOnline={apiOnline}

        enrichStatus={record?.status}

        locationLocked={locationLocked}

        hasReport={hasReport}

        loadingQuote={loadingQuote}

      />



      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">

        <aside className="flex min-h-0 w-full shrink-0 flex-col border-r border-panel-border bg-panel-bg lg:w-[380px] xl:w-[400px]">

          <div className="min-h-0 flex-1 overflow-y-auto sleek-scrollbar">

            <PropertySearchBar

              address={addressDraft}

              loading={loadingReport}

              resolving={resolvingAddress}

              locationLocked={locationLocked}

              onAddressChange={handleAddressChange}

              onAddressSelect={handleAddressSelect}

              onClear={handleClear}

            />

            <IntentPackagePicker

              presets={catalog?.presets}

              catalog={catalog}

              activePresetId={activePresetId}

              onApply={applyPreset}

              disabled={loadingReport || loadingCatalog}

              locationLocked={locationLocked}

            />

            {billingNotice ? (
              <div className="border-b border-command-stable/30 bg-command-stable/5 px-4 py-2">
                <p className="font-mono text-[9px] leading-relaxed text-command-stable">{billingNotice}</p>
                <button
                  type="button"
                  onClick={() => setBillingNotice(null)}
                  className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-faint hover:text-ink-secondary"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {presetNotice ? (

              <div className="border-b border-command-watch/30 bg-command-watch/5 px-4 py-2">

                <p className="font-mono text-[9px] leading-relaxed text-command-watch">{presetNotice}</p>

                <button

                  type="button"

                  onClick={clearPresetNotice}

                  className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-faint hover:text-ink-secondary"

                >

                  Dismiss

                </button>

              </div>

            ) : null}

            <AdvancedDrawer
              open={advancedOpen}
              onToggle={() => setAdvancedOpen(v => !v)}
              badges={advancedBadges}
              subtitle={
                missingRequiredUrls.length > 0
                  ? 'Finish required inputs to generate'
                  : record
                    ? 'Review sources, URLs, and results'
                    : 'Sources, URLs, and results'
              }
            >
              {requiredUrlIds.length > 0 ? (
                <div className="lg:hidden">
                  <PublicSourcePanel
                    catalog={catalog}
                    selectedSources={selectedSources}
                    address={address}
                    locationLocked={locationLocked}
                    apiOnline={apiOnline}
                    disabled={loadingReport}
                    sourceUrls={sourceUrls}
                    onSourceUrlsChange={setSourceUrls}
                    onPaymentRequired={() =>
                      setBillingNotice('Add credits using the Credits button in the header, then try again.')
                    }
                    variant="sidebar"
                  />
                </div>
              ) : null}

              <SourceCatalogPanel
                catalog={catalog}
                selectedSources={selectedSources}
                onToggle={toggleSource}
                disabled={loadingReport || loadingCatalog}
                quote={quote}
                activePresetId={activePresetId}
                apiOnline={apiOnline}
              />

              <ReportResultsPanel
                record={record}
                error={error}
                loading={loadingReport}
                apiOnline={apiOnline}
              />
            </AdvancedDrawer>

          </div>



          <LiveReceipt

            quote={displayQuote}

            loading={loadingQuote}

            loadingReport={loadingReport}

            address={addressDraft}

            selectedCount={selectedSources.length}

            locationLocked={locationLocked}

            generateDisabled={
              !address.trim() ||
              selectedSources.length === 0 ||
              loadingQuote ||
              missingRequiredUrls.length > 0
            }

            onGenerate={handleGenerate}

            sticky

          />

        </aside>



        <main className="relative min-h-[240px] min-w-0 flex-1 lg:min-h-0">

          <PropertyMap

            lat={mapLat}

            lng={mapLng}

            label={displayLabel}

            flyDelay={mapView?.immediate ? 0 : 400}

            showPlaceholder={mapLat == null || mapLng == null}

            locationLocked={locationLocked}

            loadingReport={loadingReport}

            onMapReady={setMapInstance}

          />

          {requiredUrlIds.length > 0 ? (
            <div className="absolute inset-0 z-[22] hidden lg:block">
              <MapSourceDiscoveryHud
                map={mapInstance}
                lat={mapLat}
                lng={mapLng}
                locationLocked={locationLocked}
                visible={mapInstance != null && mapLat != null && mapLng != null}
              >
                <PublicSourcePanel
                  catalog={catalog}
                  selectedSources={selectedSources}
                  address={address}
                  locationLocked={locationLocked}
                  apiOnline={apiOnline}
                  disabled={loadingReport}
                  sourceUrls={sourceUrls}
                  onSourceUrlsChange={setSourceUrls}
                  onPaymentRequired={() =>
                    setBillingNotice('Add credits using the Credits button in the header, then try again.')
                  }
                  variant="hud"
                />
              </MapSourceDiscoveryHud>
            </div>
          ) : null}

        </main>

      </div>

    </div>

  )

}

