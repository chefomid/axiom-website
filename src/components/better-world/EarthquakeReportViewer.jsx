import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import html2pdf from 'html2pdf.js'

import useEarthquakeAnalytics from '../../hooks/useEarthquakeAnalytics'
import { assessTemporalPeriodQuality, dateRangeForYears } from '../../utils/earthquakeAnalytics'
import {
  buildReportNarrative,
  formatReportDate,
  reportPdfFilename,
  REPORT_DEPTH_PRESETS,
} from '../../utils/earthquakeReport'
import {
  DepthBreakdownGuide,
  MagnitudeDistributionGuide,
  NearestFaultGuide,
  ReturnPeriodsGuide,
} from './EarthquakeDigestGuides'
import {
  AnnularDensityChart,
  CumulativeRadiusChart,
  CumulativeTimeChart,
  MagnitudeDistributionChart,
  TemporalDensityChart,
} from './EarthquakeRadiusCharts'
import { TemporalActivityGuide } from './EarthquakeStatDigestPanel'
import ReportGeneratingIndicator from './ReportGeneratingIndicator'

const ACTIVITY_BADGE_CLASS = {
  stable: 'eq-report-activity-badge eq-report-activity-badge--stable',
  watch: 'eq-report-activity-badge eq-report-activity-badge--watch',
  seismic: 'eq-report-activity-badge eq-report-activity-badge--seismic',
}

const SECTION_TITLES = {
  'temporal-activity': 'How activity changed over time',
  'return-periods': 'How often larger earthquakes occur',
  'magnitude-distribution': 'Earthquake magnitudes in this area',
  'depth-breakdown': 'Earthquake depths',
  'nearest-fault': 'Nearest mapped fault',
}

function ReportBlock({ title, subtitle, children, badge = null, className = '' }) {
  return (
    <section className={`eq-report-block eq-report-section ${className}`.trim()}>
      <div className="eq-report-block__head">
        <h2 className="eq-report-block__title">{title}</h2>
        {badge}
      </div>
      {subtitle ? <p className="eq-report-block__subtitle">{subtitle}</p> : null}
      {children}
    </section>
  )
}

function ReportMetric({ label, value, accent = false }) {
  return (
    <div className="eq-report-metric">
      <p className="eq-report-metric__label">{label}</p>
      <p className={`eq-report-metric__value ${accent ? 'eq-report-metric__value--accent' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function ReportChartFrame({ children }) {
  return <div className="eq-report-chart-frame eq-report-chart">{children}</div>
}

function FilterPills({ filterSummary }) {
  const parts = String(filterSummary ?? '')
    .split('·')
    .map(s => s.trim())
    .filter(Boolean)
  return (
    <div className="eq-report-hero__filters">
      {parts.map(part => (
        <span key={part} className="eq-report-hero__filter-pill">
          {part}
        </span>
      ))}
    </div>
  )
}

export default function EarthquakeReportViewer({
  open,
  onClose,
  config,
  generating = false,
  resolveError = null,
  onReady,
  scope,
  userLocation,
  countryId,
  yearPresetId,
  minMagnitude,
}) {
  const reportRef = useRef(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const {
    loading,
    error,
    truncated,
    resolved,
    yearPreset,
    summary,
    cumulative,
    annular,
    events,
    dataQuality,
    globalAnalysis,
    hasTemporalAnalytics,
    temporalCumulative,
    temporalAnnular,
  } = useEarthquakeAnalytics({
    scope,
    userLocation,
    countryId,
    analysisCountryId: config?.analysisCountryId ?? 'US',
    centerOverride: config?.centerOverride ?? null,
    minMagnitude: config?.minMagnitude ?? minMagnitude,
    maxRadiusMiles: config?.maxRadiusMiles ?? 250,
    yearPresetId: config?.yearPresetId ?? yearPresetId,
    enabled: open && Boolean(config?.centerOverride),
  })

  useEffect(() => {
    if (!open || !config || loading) return
    onReady?.()
  }, [open, config, loading, onReady])

  const showGenerating = (!config && generating) || (Boolean(config) && loading)
  const displayError = resolveError || (!showGenerating && error)
  const reportReady = Boolean(config) && !loading && (summary || dataQuality?.level === 'none')
  const narrative = useMemo(
    () =>
      !config
        ? null
        : buildReportNarrative({
        scope: config?.scope ?? 'location',
        locationLabel: resolved?.locationLabel ?? config?.centerOverride?.label ?? 'Selected location',
        yearPreset,
        minMagnitude,
        activeMaxRadiusMiles: config?.maxRadiusMiles ?? 250,
        globalAnalysis,
        summary,
        events,
      }),
    [
      config,
      config?.scope,
      config?.maxRadiusMiles,
      resolved?.locationLabel,
      config?.centerOverride?.label,
      yearPreset,
      minMagnitude,
      globalAnalysis,
      summary,
      events,
    ],
  )

  const { startDate } = useMemo(
    () => dateRangeForYears(yearPreset?.years ?? 5),
    [yearPreset?.years],
  )

  const temporalPeriodQuality = useMemo(
    () => assessTemporalPeriodQuality(temporalAnnular, { truncated }),
    [temporalAnnular, truncated],
  )

  const depthLabel =
    REPORT_DEPTH_PRESETS.find(p => p.id === config?.depthId)?.label ?? 'Standard'

  const guideProps = {
    center: config?.centerOverride,
    temporalAnnular,
    temporalPeriodQuality,
    yearPreset,
    activeMaxRadiusMiles: config?.maxRadiusMiles ?? 250,
    minMagnitude,
    summary,
    events,
    startDate,
    loading,
    hasTemporalAnalytics,
    globalAnalysis,
    dataQuality,
  }

  const renderSection = sectionId => {
    switch (sectionId) {
      case 'temporal-activity':
        return <TemporalActivityGuide {...guideProps} />
      case 'return-periods':
        return <ReturnPeriodsGuide {...guideProps} />
      case 'magnitude-distribution':
        return <MagnitudeDistributionGuide {...guideProps} />
      case 'depth-breakdown':
        return <DepthBreakdownGuide {...guideProps} />
      case 'nearest-fault':
        return <NearestFaultGuide {...guideProps} />
      default:
        return null
    }
  }

  const strongestValue =
    summary?.maxEvent?.mag != null
      ? globalAnalysis
        ? `M${summary.maxEvent.mag.toFixed(1)}`
        : `M${summary.maxEvent.mag.toFixed(1)} · ${summary.maxEvent.dist?.toFixed(0) ?? '—'} mi`
      : '—'

  const handleDownloadPdf = async () => {
    if (!reportRef.current || pdfBusy) return
    setPdfBusy(true)
    try {
      await html2pdf()
        .set({
          margin: [10, 12, 14, 12],
          filename: reportPdfFilename(resolved?.locationLabel ?? config?.centerOverride?.label),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2.5,
            useCORS: true,
            backgroundColor: '#050505',
            logging: false,
            windowWidth: 680,
            onclone: doc => {
              const root = doc.querySelector('.eq-report-doc')
              if (root) root.classList.add('eq-report-pdf-export')
              doc.querySelectorAll('.recharts-tooltip-wrapper').forEach(el => {
                el.remove()
              })
            },
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
          pagebreak: {
            mode: ['css', 'legacy'],
            before: '.eq-report-page-break',
            avoid: ['.eq-report-block', '.eq-report-chart-frame', '.eq-report-hero'],
          },
        })
        .from(reportRef.current)
        .save()
    } finally {
      setPdfBusy(false)
    }
  }

  const showCharts = config?.includeCharts && !showGenerating && dataQuality?.level !== 'none'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="eq-report-viewer fixed inset-0 z-[70] flex flex-col bg-[#050505]"
        >
          <header className="eq-report-no-print flex shrink-0 items-center gap-3 border-b border-[#222] bg-[#0a0a0a] px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="section-label-sm tracking-[0.22em]">Seismic activity report</p>
              {!showGenerating && config ? (
                <p className="truncate font-mono text-[11px] text-white">
                  {config.centerOverride?.label ?? resolved?.locationLabel}
                </p>
              ) : null}
            </div>
            {!showGenerating && reportReady ? (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfBusy}
                className="rounded-lg border border-[#ff9348]/40 bg-[#ff9348]/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff9348] transition hover:border-[#ff9348]/60 hover:bg-[#ff9348]/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pdfBusy ? 'Saving…' : 'Download PDF'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#333] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition hover:text-white"
            >
              Close
            </button>
          </header>

          <div className="sleek-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8">
            {showGenerating ? (
              <ReportGeneratingIndicator />
            ) : displayError ? (
              <p className="py-16 text-center font-mono text-[11px] text-command-critical">{displayError}</p>
            ) : config && narrative ? (
              <article ref={reportRef} className="eq-report-doc pb-12">
                <header className="eq-report-hero">
                  <div className="eq-report-hero__brand">
                    <span className="eq-report-hero__eyebrow">USGS Earthquake Catalog</span>
                    <span className="eq-report-hero__badge">{depthLabel} report</span>
                  </div>
                  <h1 className="eq-report-hero__title">Seismic Activity Report</h1>
                  <p className="eq-report-hero__location">
                    {resolved?.locationLabel ?? config.centerOverride?.label}
                  </p>
                  <FilterPills filterSummary={narrative.filterSummary} />
                  <p className="eq-report-hero__date">Generated {formatReportDate()}</p>
                </header>

                {dataQuality?.level === 'none' ? (
                  <ReportBlock title="No catalog data">
                    <p className="eq-report-block__body text-command-watch">
                      {dataQuality.message ??
                        'No events match these filters for the selected focus.'}
                    </p>
                  </ReportBlock>
                ) : (
                  <>
                    <ReportBlock
                      title="At a glance"
                      badge={
                        <span className={ACTIVITY_BADGE_CLASS[narrative.activityLevel.tone]}>
                          {narrative.activityLevel.label}
                        </span>
                      }
                    >
                      <p className="eq-report-block__body eq-report-block__body--bright">
                        {narrative.headline}
                      </p>
                      <div className="eq-report-metrics mt-4">
                        <ReportMetric
                          label="Total events"
                          value={(summary?.totalEvents ?? 0).toLocaleString()}
                          accent
                        />
                        <ReportMetric label="Strongest" value={strongestValue} />
                        {!globalAnalysis && summary?.peakDensityPer1000SqMiPerYear != null ? (
                          <ReportMetric
                            label="Peak density"
                            value={`${summary.peakDensityPer1000SqMiPerYear.toFixed(1)} / yr`}
                          />
                        ) : null}
                        <ReportMetric
                          label="Avg per year"
                          value={
                            narrative.eventsPerYear >= 10
                              ? Math.round(narrative.eventsPerYear).toLocaleString()
                              : narrative.eventsPerYear.toFixed(1)
                          }
                        />
                      </div>
                    </ReportBlock>

                    <ReportBlock title="What this means">
                      <p className="eq-report-block__body">{narrative.meaning}</p>
                      {narrative.bullets.length > 0 ? (
                        <ul className="eq-report-bullets">
                          {narrative.bullets.map(bullet => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                    </ReportBlock>

                    {showCharts ? (
                      <>
                        {!globalAnalysis ? (
                          <>
                            <ReportBlock
                              title="Cumulative frequency"
                              subtitle={
                                hasTemporalAnalytics
                                  ? `Events within ${config.maxRadiusMiles} mi, cumulated through the selected window.`
                                  : 'Events within each distance band over the selected window.'
                              }
                            >
                              <ReportChartFrame>
                                {hasTemporalAnalytics ? (
                                  <CumulativeTimeChart data={temporalCumulative} />
                                ) : (
                                  <CumulativeRadiusChart data={cumulative} />
                                )}
                              </ReportChartFrame>
                            </ReportBlock>

                            <ReportBlock
                              title="Events by distance"
                              subtitle="Earthquake density in each radius band from the report focus."
                            >
                              <ReportChartFrame>
                                <AnnularDensityChart data={annular} view="density" />
                              </ReportChartFrame>
                            </ReportBlock>

                            {hasTemporalAnalytics && temporalAnnular?.length ? (
                              <ReportBlock
                                title="Activity by time period"
                                subtitle="How earthquake counts varied across each period in the search radius."
                              >
                                <ReportChartFrame>
                                  <TemporalDensityChart data={temporalAnnular} view="density" />
                                </ReportChartFrame>
                              </ReportBlock>
                            ) : null}
                          </>
                        ) : null}

                        <div className="eq-report-page-break" aria-hidden />

                        <ReportBlock
                          title="Magnitude distribution"
                          subtitle="Share of events in each magnitude band for this report focus."
                        >
                          <ReportChartFrame>
                            <MagnitudeDistributionChart events={events} minMagnitude={minMagnitude} />
                          </ReportChartFrame>
                        </ReportBlock>
                      </>
                    ) : null}

                    {config.sectionIds?.map(sectionId => (
                      <ReportBlock key={sectionId} title={SECTION_TITLES[sectionId] ?? sectionId}>
                        <div className="eq-report-block__body">{renderSection(sectionId)}</div>
                      </ReportBlock>
                    ))}
                  </>
                )}

                <footer className="eq-report-block eq-report-section">
                  <div className="eq-report-block__head">
                    <h2 className="eq-report-block__title">Data &amp; limitations</h2>
                  </div>
                  <div className="eq-report-footer">
                    <p>
                      Source: USGS Earthquake Catalog. Counts reflect published historical records for
                      the selected magnitude threshold and time window.
                    </p>
                    <p>
                      Past earthquake activity does not predict when or where future earthquakes will
                      occur. This report is for general awareness — not engineering, insurance, or
                      emergency planning decisions.
                    </p>
                    {dataQuality?.message && dataQuality.level !== 'ok' && dataQuality.level !== 'none' ? (
                      <p style={{ color: '#e8a838' }}>{dataQuality.message}</p>
                    ) : null}
                  </div>
                </footer>
              </article>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
