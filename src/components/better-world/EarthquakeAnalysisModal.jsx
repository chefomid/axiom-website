import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import {
  ANALYTICS_RADIUS_BREAKPOINTS,
  ANALYTICS_YEAR_PRESETS,
  EARTHQUAKE_MAGNITUDE_OPTIONS,
  NATIONAL_US_MAX_RADIUS_MILES,
  NATIONAL_US_RADIUS_BREAKPOINTS,
  NATIONAL_US_RADIUS_OPTIONS,
  RADIUS_OPTIONS,
  SEISMIC_ANALYSIS_COUNTRIES,
  SEISMIC_COUNTRY_BBOX,
} from '../../data/commandMapData'
import { preloadFaultLineDots, preloadFaultLines } from '../../services/faultLines'
import useEarthquakeAnalytics from '../../hooks/useEarthquakeAnalytics'
import { buildReportConfigFromDraft } from '../../utils/earthquakeReport'
import { countryCenterLocation, globalCenterLocation } from '../../services/geocode'
import {
  ANNULAR_VIEW_OPTIONS,
  AnnularDensityChart,
  CumulativeRadiusChart,
  CumulativeTimeChart,
  getAnnularViewConfig,
} from './EarthquakeRadiusCharts'
import EarthquakeAnalysisMap from './EarthquakeAnalysisMap'
import EarthquakeAnalysisSidebar from './EarthquakeAnalysisSidebar'
import EarthquakeReportBuilderModal from './EarthquakeReportBuilderModal'
import EarthquakeReportViewer from './EarthquakeReportViewer'
import EarthquakeStatDigestPanel from './EarthquakeStatDigestPanel'
import AnalysisLoadingOverlay from './AnalysisLoadingOverlay'

function resolveInitialCountry(countryId) {
  return (
    SEISMIC_ANALYSIS_COUNTRIES.find(c => c.id === countryId) ??
    SEISMIC_ANALYSIS_COUNTRIES.find(c => c.id === 'US') ??
    SEISMIC_ANALYSIS_COUNTRIES[0]
  )
}

function resolveAnalysisLandingState({ countryId, initialCenterOverride }) {
  if (initialCenterOverride) {
    return {
      analysisCountryId: resolveInitialCountry(countryId).id,
      centerOverride: initialCenterOverride,
      maxRadiusMiles: 250,
    }
  }

  const country = resolveInitialCountry(countryId)
  if (country.id === 'GLOBAL') {
    return {
      analysisCountryId: 'GLOBAL',
      centerOverride: globalCenterLocation(),
      maxRadiusMiles: 250,
    }
  }

  return {
    analysisCountryId: country.id,
    centerOverride: countryCenterLocation(country),
    maxRadiusMiles: NATIONAL_US_MAX_RADIUS_MILES,
  }
}

function SummaryMetric({ label, value, highlight = false }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      <p
        className={`mt-0.5 truncate font-mono text-[11px] tabular-nums ${
          highlight ? 'text-[#ff9348]' : 'text-white'
        }`}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
    </div>
  )
}

export default function EarthquakeAnalysisModal({
  open,
  onClose,
  scope,
  userLocation,
  countryId,
  initialMinMagnitude = 2.5,
  initialCenterOverride = null,
}) {
  const [yearPresetId, setYearPresetId] = useState('5y')
  const [minMagnitude, setMinMagnitude] = useState(initialMinMagnitude)
  const [maxRadiusMiles, setMaxRadiusMiles] = useState(250)
  const [analysisCountryId, setAnalysisCountryId] = useState(() => resolveInitialCountry(countryId).id)
  const [addressQuery, setAddressQuery] = useState('')
  const [centerOverride, setCenterOverride] = useState(null)
  const [recenterKey, setRecenterKey] = useState(0)
  const [annularViewId, setAnnularViewId] = useState('density')
  const [showFaultLines, setShowFaultLines] = useState(false)
  const [showNoDataNotice, setShowNoDataNotice] = useState(false)
  const [digestOpen, setDigestOpen] = useState(false)
  const [digestExpanded, setDigestExpanded] = useState(true)
  const [reportBuilderOpen, setReportBuilderOpen] = useState(false)
  const [reportViewOpen, setReportViewOpen] = useState(false)
  const [reportConfig, setReportConfig] = useState(null)
  const [reportGenerating, setReportGenerating] = useState(false)
  const [reportResolveError, setReportResolveError] = useState(null)

  const landing = useMemo(
    () =>
      open
        ? resolveAnalysisLandingState({ countryId, initialCenterOverride })
        : null,
    [
      open,
      countryId,
      initialCenterOverride?.lat,
      initialCenterOverride?.lng,
      initialCenterOverride?.label,
    ],
  )

  const activeCenterOverride = centerOverride ?? landing?.centerOverride ?? null
  const activeAnalysisCountryId =
    centerOverride != null ? analysisCountryId : (landing?.analysisCountryId ?? analysisCountryId)
  const activeMaxRadiusMiles =
    centerOverride != null ? maxRadiusMiles : (landing?.maxRadiusMiles ?? maxRadiusMiles)

  useLayoutEffect(() => {
    if (!open || !landing) return undefined
    setMinMagnitude(initialMinMagnitude)
    setShowFaultLines(false)
    setAddressQuery('')
    setAnalysisCountryId(landing.analysisCountryId)
    setCenterOverride(landing.centerOverride)
    setRecenterKey(0)
    setMaxRadiusMiles(landing.maxRadiusMiles)
    setDigestOpen(false)
    setDigestExpanded(true)
    setReportBuilderOpen(false)
    setReportViewOpen(false)
    setReportConfig(null)
    setReportGenerating(false)
    setReportResolveError(null)
    return undefined
  }, [
    open,
    landing,
    initialMinMagnitude,
  ])

  useEffect(() => {
    if (!open) {
      setShowNoDataNotice(false)
      setDigestOpen(false)
      setReportBuilderOpen(false)
      setReportViewOpen(false)
      setReportConfig(null)
      setReportGenerating(false)
      setReportResolveError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const deferId = window.setTimeout(() => {
      preloadFaultLineDots()
      preloadFaultLines()
    }, 0)
    return () => window.clearTimeout(deferId)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (showNoDataNotice) {
        setShowNoDataNotice(false)
        return
      }
      if (reportViewOpen) {
        setReportViewOpen(false)
        return
      }
      if (reportBuilderOpen) {
        setReportBuilderOpen(false)
        return
      }
      if (digestOpen) {
        setDigestOpen(false)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, showNoDataNotice, digestOpen, reportBuilderOpen, reportViewOpen])

  const {
    loading,
    refreshing,
    error,
    truncated,
    resolved,
    yearPreset,
    summary,
    cumulative,
    annular,
    events,
    dataQuality,
    refetch,
    nationalAnalysis,
    countryOverview,
    globalAnalysis,
    hasTemporalAnalytics,
    temporalCumulative,
    temporalAnnular,
  } = useEarthquakeAnalytics({
    scope,
    userLocation,
    countryId,
    analysisCountryId: activeAnalysisCountryId,
    centerOverride: activeCenterOverride,
    minMagnitude,
    maxRadiusMiles: activeMaxRadiusMiles,
    yearPresetId,
    enabled: open && Boolean(activeCenterOverride),
  })

  useEffect(() => {
    if (dataQuality?.level !== 'none') setShowNoDataNotice(false)
  }, [dataQuality?.level])

  useEffect(() => {
    if (!open || !countryOverview) return undefined
    setMaxRadiusMiles(prev =>
      NATIONAL_US_RADIUS_OPTIONS.includes(prev) ? prev : NATIONAL_US_MAX_RADIUS_MILES,
    )
    return undefined
  }, [open, countryOverview])

  const annularView = getAnnularViewConfig(annularViewId)

  const distanceOptions = useMemo(() => {
    if (nationalAnalysis || countryOverview) {
      return NATIONAL_US_RADIUS_OPTIONS
    }
    return RADIUS_OPTIONS.filter(miles => ANALYTICS_RADIUS_BREAKPOINTS.includes(miles))
  }, [nationalAnalysis, countryOverview])

  const handleCountryChange = nextCountryId => {
    const country = SEISMIC_ANALYSIS_COUNTRIES.find(c => c.id === nextCountryId)
    if (!country) return
    setAnalysisCountryId(country.id)
    setAddressQuery('')
    if (country.id === 'GLOBAL') {
      setCenterOverride(globalCenterLocation())
    } else {
      setCenterOverride(countryCenterLocation(country))
      setMaxRadiusMiles(NATIONAL_US_MAX_RADIUS_MILES)
    }
    setRecenterKey(k => k + 1)
  }

  const handleLocationSelect = location => {
    setCenterOverride(location)
    setRecenterKey(k => k + 1)
    if (location.label?.startsWith('Global (')) {
      return
    }
    const isOverview = location.label?.includes('(overview)')
    if (isOverview) {
      setMaxRadiusMiles(NATIONAL_US_MAX_RADIUS_MILES)
    } else {
      setMaxRadiusMiles(250)
    }
  }

  const alertNodes = []
  if (error) {
    alertNodes.push(
      <div key="error" className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[10px] text-command-critical">{error}</p>
        <button
          type="button"
          onClick={refetch}
          className="font-mono text-[10px] uppercase tracking-widest text-ink-muted transition hover:text-white"
        >
          Retry
        </button>
      </div>,
    )
  }
  if (!refreshing && !loading && !error && dataQuality?.level !== 'ok' && dataQuality?.level !== 'none' && dataQuality?.message) {
    alertNodes.push(
      <p
        key="quality"
        className="rounded-lg border border-command-watch/40 bg-command-watch/10 px-3 py-2 font-mono text-[10px] leading-relaxed text-command-watch"
      >
        {dataQuality.message}
      </p>,
    )
  }

  const dataReady = !refreshing && Boolean(summary)
  const chartsReady = dataReady && dataQuality?.level !== 'none' && !globalAnalysis
  const summaryReady = dataReady && dataQuality?.level !== 'none'
  const showLoadingOverlay = (loading || refreshing) && !error

  const handleReportGenerate = async draft => {
    setReportBuilderOpen(false)
    setReportViewOpen(true)
    setReportGenerating(true)
    setReportResolveError(null)
    setReportConfig(null)

    try {
      const config = await buildReportConfigFromDraft(draft, { mapUserLocation: userLocation })
      setReportConfig(config)
    } catch (err) {
      setReportResolveError(err?.message ?? 'Could not build report for this selection.')
      setReportGenerating(false)
    }
  }

  const handleReportReady = () => {
    setReportGenerating(false)
  }

  const layoutRevision = useMemo(
    () => `${digestOpen ? 1 : 0}-${digestExpanded ? 1 : 0}`,
    [digestOpen, digestExpanded],
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex bg-[#050505]"
        >
          <EarthquakeAnalysisSidebar
            onClose={onClose}
            onOpenReport={() => setReportBuilderOpen(true)}
            headerTitle="Earthquake frequency by radius"
            headerMeta={
              globalAnalysis
                ? `${resolved.locationLabel} · ${resolved.scopeLabel} · ${yearPreset.label} · M${minMagnitude}+`
                : `${resolved.locationLabel} · ${resolved.scopeLabel} · ${yearPreset.label} · ${activeMaxRadiusMiles} mi · M${minMagnitude}+`
            }
            locationProps={{
              countryId: activeAnalysisCountryId,
              onCountryChange: handleCountryChange,
              addressQuery,
              onAddressChange: setAddressQuery,
              onLocationSelect: handleLocationSelect,
              mapUserLocation: userLocation,
              disabled: refreshing,
            }}
            timelineProps={{
              presets: ANALYTICS_YEAR_PRESETS,
              activeId: yearPresetId,
              onChange: setYearPresetId,
              disabled: refreshing,
            }}
            distanceProps={{
              options: distanceOptions,
              activeMiles: activeMaxRadiusMiles,
              onChange: setMaxRadiusMiles,
              isNational: nationalAnalysis || countryOverview,
              isGlobal: globalAnalysis,
            }}
            magnitudeProps={{
              options: EARTHQUAKE_MAGNITUDE_OPTIONS,
              activeValue: minMagnitude,
              disabled: refreshing,
              loading: refreshing,
              onChange: setMinMagnitude,
            }}
            alerts={alertNodes}
          />

          <div className="flex min-h-0 min-w-0 flex-1">
            <main className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
              <div className="relative flex min-h-0 flex-1 flex-col">
                {!resolved.center ? (
                  <div className="flex flex-1 items-center justify-center px-6">
                    <p className="max-w-sm text-center font-mono text-[11px] leading-relaxed text-ink-faint">
                      Select a location in the sidebar to load the USGS earthquake catalog.
                    </p>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="relative min-h-0 flex-1 [&_.command-map-host]:min-h-0 [&_.command-map-host]:h-full">
                      {showLoadingOverlay ? <AnalysisLoadingOverlay /> : null}
                      <div
                        className={`flex h-full min-h-0 flex-col transition-[filter,opacity] duration-300 ${
                          dataQuality?.level === 'none' ? 'opacity-45 saturate-[0.35]' : ''
                        } ${showLoadingOverlay ? 'opacity-50' : ''}`}
                      >
                        <EarthquakeAnalysisMap
                          center={resolved.center}
                          label={resolved.locationLabel}
                          recenterKey={recenterKey}
                          events={events}
                          maxRadiusMiles={activeMaxRadiusMiles}
                          showFaultLines={showFaultLines}
                          onFaultLinesChange={setShowFaultLines}
                          nationalAnalysis={nationalAnalysis}
                          countryOverviewAnalysis={countryOverview}
                          countryBbox={SEISMIC_COUNTRY_BBOX[activeAnalysisCountryId] ?? null}
                          globalAnalysis={globalAnalysis}
                          highlightHomeUnit={hasTemporalAnalytics}
                          yearPresetLabel={yearPreset.label}
                          radiusBreakpoints={
                            nationalAnalysis || countryOverview
                              ? NATIONAL_US_RADIUS_BREAKPOINTS
                              : ANALYTICS_RADIUS_BREAKPOINTS
                          }
                          layoutRevision={layoutRevision}
                        />
                      </div>

                      <div className="eq-map-btn-stack absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
                        {dataQuality?.level === 'none' && !loading ? (
                          <button
                            type="button"
                            onClick={() => setShowNoDataNotice(true)}
                            className="rounded-lg border border-command-watch/40 bg-command-watch/10 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-command-watch shadow-lg transition hover:border-command-watch/60 hover:bg-command-watch/15"
                          >
                            NO DATA
                          </button>
                        ) : null}

                        {!digestOpen ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDigestOpen(true)
                              setDigestExpanded(true)
                            }}
                            className="rounded-lg border border-[#ff9348]/40 bg-[#ff9348]/10 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff9348] shadow-lg transition hover:border-[#ff9348]/60 hover:bg-[#ff9348]/15"
                          >
                            STAT DIGEST
                          </button>
                        ) : null}
                      </div>

                      {showNoDataNotice ? (
                        <div
                          className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-[#050505]/35 p-6 backdrop-blur-[1px]"
                          onClick={() => setShowNoDataNotice(false)}
                          role="presentation"
                        >
                          <div
                            className="max-w-md rounded-xl border border-command-watch/35 bg-[#0a0a0a]/95 px-6 py-5 text-center shadow-2xl backdrop-blur-md"
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => e.stopPropagation()}
                            role="dialog"
                            aria-labelledby="eq-no-data-notice-title"
                          >
                            <p
                              id="eq-no-data-notice-title"
                              className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-command-watch"
                            >
                              Notice
                            </p>
                            <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
                              {dataQuality.message}
                            </p>
                            <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-faint">
                              Choose another location in the sidebar, try a shorter time window, or select a specific country (US, MX, JP) for regional analysis.
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowNoDataNotice(false)}
                              className="mt-4 rounded-lg border border-command-watch/40 bg-command-watch/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-command-watch transition hover:border-command-watch/60 hover:bg-command-watch/15"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <EarthquakeStatDigestPanel
                      open={digestOpen}
                      expanded={digestExpanded}
                      onExpandedChange={setDigestExpanded}
                      onClose={() => setDigestOpen(false)}
                      center={resolved.center}
                      loading={refreshing}
                      truncated={truncated}
                      yearPreset={yearPreset}
                      globalAnalysis={globalAnalysis}
                      hasTemporalAnalytics={hasTemporalAnalytics}
                      activeMaxRadiusMiles={activeMaxRadiusMiles}
                      minMagnitude={minMagnitude}
                      summary={summary}
                      events={events}
                      temporalAnnular={temporalAnnular}
                      dataQuality={dataQuality}
                    />
                  </div>
                )}
              </div>
            </main>

            <aside className="sleek-scrollbar flex w-[min(100%,380px)] shrink-0 flex-col border-l border-[#222] bg-[#080808]">
              <div className="shrink-0 border-b border-[#222] px-4 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
                  Metrics
                </p>
                <p className="mt-1 font-mono text-[12px] text-white">Charts &amp; summary</p>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
                {!summaryReady && !chartsReady ? (
                  <p className="py-8 text-center font-mono text-[10px] text-ink-faint">
                    {refreshing ? 'Loading charts for this selection…' : 'No chart data for this location.'}
                  </p>
                ) : (
                  <>
                    <section className="shrink-0 rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2">
                      <p className="mb-1.5 section-label">
                        Summary
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        <SummaryMetric label="Total events" value={summary?.totalEvents ?? 0} />
                        {!globalAnalysis ? (
                          <SummaryMetric
                            label="Peak density"
                            value={
                              summary?.peakDensityPer1000SqMiPerYear != null
                                ? `${summary.peakDensityPer1000SqMiPerYear.toFixed(2)} / yr / 1k sq mi`
                                : '-'
                            }
                          />
                        ) : null}
                        <SummaryMetric
                          label="Strongest"
                          value={
                            summary?.maxEvent?.mag != null
                              ? globalAnalysis
                                ? `M${summary.maxEvent.mag.toFixed(1)}`
                                : `M${summary.maxEvent.mag.toFixed(1)} @ ${summary.maxEvent.dist.toFixed(0)} mi`
                              : '-'
                          }
                        />
                      </div>
                      {globalAnalysis ? (
                        <p className="mt-2 font-mono text-[9px] leading-relaxed text-ink-faint">
                          Map shows up to 20,000 events worldwide, balanced across continents for the
                          selected timeline.
                        </p>
                      ) : null}
                    </section>

                    {chartsReady ? (
                      <>
                        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] p-3">
                          <p className="shrink-0 section-label">
                            Cumulative frequency
                          </p>
                          <p className="mt-0.5 shrink-0 font-mono text-[9px] leading-snug text-ink-faint">
                            {hasTemporalAnalytics
                              ? `Events within ${activeMaxRadiusMiles} mi, cumulated through the selected window.`
                              : 'Events within each radius over the selected window.'}
                          </p>
                          <div className="mt-1.5 min-h-0 flex-1">
                            {hasTemporalAnalytics ? (
                              <CumulativeTimeChart data={temporalCumulative} />
                            ) : (
                              <CumulativeRadiusChart data={cumulative} />
                            )}
                          </div>
                        </section>

                        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] p-3">
                          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <p className="section-label">
                              Annular density
                            </p>
                            <div className="flex shrink-0 flex-wrap items-center gap-4 pl-2">
                              {ANNULAR_VIEW_OPTIONS.map(option => (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setAnnularViewId(option.id)}
                                  className={`pl-2.5 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors ${
                                    annularViewId === option.id
                                      ? 'text-white'
                                      : 'text-ink-faint hover:text-ink-secondary'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <p className="mt-3 shrink-0 font-mono text-[9px] leading-snug text-ink-faint line-clamp-2">
                            {annularView.subtitle}
                          </p>
                          <div className="mt-1.5 min-h-0 flex-1 overflow-visible">
                            <AnnularDensityChart data={annular} view={annularViewId} />
                          </div>
                        </section>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </aside>
          </div>

          <EarthquakeReportBuilderModal
            open={reportBuilderOpen}
            onClose={() => setReportBuilderOpen(false)}
            onGenerate={handleReportGenerate}
            analysisCountryId={activeAnalysisCountryId}
            currentCenterOverride={activeCenterOverride}
            mapUserLocation={userLocation}
            initialYearPresetId={yearPresetId}
            initialMinMagnitude={minMagnitude}
            initialRadiusMiles={activeMaxRadiusMiles}
            globalAnalysis={globalAnalysis}
            countryOverview={countryOverview}
          />

          <EarthquakeReportViewer
            open={reportViewOpen}
            onClose={() => {
              setReportViewOpen(false)
              setReportGenerating(false)
              setReportResolveError(null)
            }}
            config={reportConfig}
            generating={reportGenerating}
            resolveError={reportResolveError}
            onReady={handleReportReady}
            scope={scope}
            userLocation={userLocation}
            countryId={countryId}
            yearPresetId={yearPresetId}
            minMagnitude={minMagnitude}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
