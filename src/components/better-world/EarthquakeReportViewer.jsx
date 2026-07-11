import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import useEarthquakeAnalytics from '../../hooks/useEarthquakeAnalytics'
import { assessTemporalPeriodQuality, dateRangeForYears } from '../../utils/earthquakeAnalytics'
import { buildReportNarrative } from '../../utils/earthquakeReport'
import { buildReportDocument } from '../../utils/reportDocument'
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

function ReportChartFrame({ children, compact = true }) {
  return (
    <div className={`eq-report-chart-frame eq-report-chart ${compact ? 'eq-report-chart-frame--compact' : ''}`.trim()}>
      {children}
    </div>
  )
}

function ReportChartCell({ label, children }) {
  return (
    <div className="eq-report-chart-cell">
      {label ? <p className="eq-report-chart-label">{label}</p> : null}
      {children}
    </div>
  )
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

  const { startDate } = useMemo(
    () => dateRangeForYears(yearPreset?.years ?? 5),
    [yearPreset?.years],
  )

  const temporalPeriodQuality = useMemo(
    () => assessTemporalPeriodQuality(temporalAnnular, { truncated }),
    [temporalAnnular, truncated],
  )

  const narrative = useMemo(
    () =>
      !config
        ? null
        : buildReportNarrative({
            scope: config?.scope ?? 'location',
            locationLabel:
              resolved?.locationLabel ?? config?.centerOverride?.label ?? 'Selected location',
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

  const reportDocument = useMemo(() => {
    if (!config || !reportReady) return null
    const locationLabel = resolved?.locationLabel ?? config.centerOverride?.label ?? 'Selected location'
    return buildReportDocument({
      config,
      locationLabel,
      summary,
      events,
      yearPreset,
      minMagnitude,
      globalAnalysis,
      hasTemporalAnalytics,
      temporalAnnular,
      temporalPeriodQuality,
      annular,
      dataQuality,
    })
  }, [
    annular,
    config,
    dataQuality,
    events,
    globalAnalysis,
    hasTemporalAnalytics,
    minMagnitude,
    reportReady,
    resolved?.locationLabel,
    summary,
    temporalAnnular,
    temporalPeriodQuality,
    yearPreset,
  ])

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

  const showCharts = config?.includeCharts && !showGenerating && dataQuality?.level !== 'none'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="eq-report-viewer eq-report-print-root fixed inset-0 z-[70] flex flex-col bg-[#050505]"
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
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#333] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition hover:text-white"
            >
              Close
            </button>
          </header>

          <div className="eq-report-print-body sleek-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8">
            {showGenerating ? (
              <ReportGeneratingIndicator />
            ) : displayError ? (
              <p className="py-16 text-center font-mono text-[11px] text-command-critical">{displayError}</p>
            ) : config && reportDocument && narrative ? (
              <article className="eq-report-doc pb-12">
                <header className="eq-report-hero">
                  <span className="eq-report-hero__eyebrow">{reportDocument.meta.dataSource}</span>
                  <h1 className="eq-report-hero__title">{reportDocument.meta.title}</h1>
                  <p className="eq-report-hero__kind">{reportDocument.meta.type}</p>
                  <p className="eq-report-hero__location">{reportDocument.meta.location}</p>
                  <FilterPills filterSummary={narrative.filterSummary} />
                  <p className="eq-report-hero__date">Generated {reportDocument.meta.generatedDate}</p>
                </header>

                {reportDocument.noData ? (
                  <ReportBlock title="No catalog data">
                    <p className="eq-report-block__body text-command-watch">
                      {reportDocument.noDataMessage}
                    </p>
                  </ReportBlock>
                ) : (
                  <>
                    <ReportBlock
                      title="At a glance"
                      badge={
                        <span className={ACTIVITY_BADGE_CLASS[narrative.activityLevel.tone]}>
                          {reportDocument.executiveSummary.activityLevel}
                        </span>
                      }
                    >
                      <p className="eq-report-block__body eq-report-block__body--bright">
                        {reportDocument.executiveSummary.headline}
                      </p>
                      <div className="eq-report-metrics mt-4">
                        {reportDocument.kpis.map(kpi => (
                          <ReportMetric
                            key={kpi.id}
                            label={kpi.label}
                            value={kpi.value}
                            accent={kpi.highlight}
                          />
                        ))}
                      </div>
                    </ReportBlock>

                    <ReportBlock title="What this means">
                      <p className="eq-report-block__body">{reportDocument.executiveSummary.meaning}</p>
                      {reportDocument.executiveSummary.bullets.length > 0 ? (
                        <ul className="eq-report-bullets">
                          {reportDocument.executiveSummary.bullets.map(bullet => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                    </ReportBlock>

                    {showCharts ? (
                      <>
                        {!globalAnalysis ? (
                          <ReportBlock
                            className="eq-report-block--charts"
                            title="Catalog charts"
                            subtitle="USGS event counts for this report focus, compact views for distance, time, and magnitude."
                          >
                            <div className="eq-report-charts-grid">
                              <ReportChartCell label="Cumulative frequency">
                                <ReportChartFrame>
                                  {hasTemporalAnalytics ? (
                                    <CumulativeTimeChart data={temporalCumulative} compact />
                                  ) : (
                                    <CumulativeRadiusChart data={cumulative} compact />
                                  )}
                                </ReportChartFrame>
                              </ReportChartCell>

                              <ReportChartCell label="Events by distance">
                                <ReportChartFrame>
                                  <AnnularDensityChart data={annular} view="density" compact />
                                </ReportChartFrame>
                              </ReportChartCell>

                              {hasTemporalAnalytics && temporalAnnular?.length ? (
                                <ReportChartCell label="Activity by time period">
                                  <ReportChartFrame>
                                    <TemporalDensityChart data={temporalAnnular} view="density" compact />
                                  </ReportChartFrame>
                                </ReportChartCell>
                              ) : null}

                              <ReportChartCell label="Magnitude distribution">
                                <ReportChartFrame>
                                  <MagnitudeDistributionChart
                                    events={events}
                                    minMagnitude={minMagnitude}
                                    compact
                                  />
                                </ReportChartFrame>
                              </ReportChartCell>
                            </div>
                          </ReportBlock>
                        ) : (
                          <ReportBlock
                            title="Magnitude distribution"
                            subtitle="Share of events in each magnitude band for this report focus."
                          >
                            <div className="eq-report-charts-grid eq-report-charts-grid--single">
                              <ReportChartCell>
                                <ReportChartFrame>
                                  <MagnitudeDistributionChart
                                    events={events}
                                    minMagnitude={minMagnitude}
                                    compact
                                  />
                                </ReportChartFrame>
                              </ReportChartCell>
                            </div>
                          </ReportBlock>
                        )}
                      </>
                    ) : null}

                    {config.sectionIds?.map(sectionId => (
                      <ReportBlock key={sectionId} title={SECTION_TITLES[sectionId] ?? sectionId}>
                        <div className="eq-report-block__body eq-report-guide">{renderSection(sectionId)}</div>
                      </ReportBlock>
                    ))}

                    <div className="eq-report-page-break" aria-hidden />
                  </>
                )}

                <footer className="eq-report-block eq-report-section">
                  <div className="eq-report-block__head">
                    <h2 className="eq-report-block__title">Data &amp; limitations</h2>
                  </div>
                  <div className="eq-report-footer">
                    <p>
                      Source: {reportDocument.methodology.source}. Counts reflect published historical
                      records for the selected magnitude threshold and time window.
                    </p>
                    <p>{reportDocument.methodology.disclaimer}</p>
                    {reportDocument.methodology.dataQualityNote ? (
                      <p className="eq-report-footnote--warn">{reportDocument.methodology.dataQualityNote}</p>
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
