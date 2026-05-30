import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { assessTemporalPeriodQuality, dateRangeForYears } from '../../utils/earthquakeAnalytics'
import {
  DepthBreakdownGuide,
  MagnitudeDistributionGuide,
  NearestFaultGuide,
  ReturnPeriodsGuide,
} from './EarthquakeDigestGuides'

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

export const DIGEST_ANALYSIS_TYPES = [
  {
    id: 'temporal-activity',
    label: 'Temporal activity',
    shortLabel: 'Time periods',
    description: 'How earthquake counts changed across each time period.',
    available: true,
  },
  {
    id: 'return-periods',
    label: 'Return periods',
    shortLabel: 'Recurrence',
    description: 'Estimated years between M5+ and M6+ events near this location.',
    available: true,
  },
  {
    id: 'magnitude-distribution',
    label: 'Magnitude mix',
    shortLabel: 'Magnitudes',
    description: 'Distribution of event magnitudes and catalog completeness.',
    available: true,
  },
  {
    id: 'depth-breakdown',
    label: 'Depth profile',
    shortLabel: 'Depth',
    description: 'Shallow vs deep earthquakes and vertical hazard context.',
    available: true,
  },
  {
    id: 'nearest-fault',
    label: 'Nearest fault',
    shortLabel: 'Fault distance',
    description: 'Distance and identity of the closest mapped fault or plate boundary.',
    available: true,
  },
]

function msAtYearsFromStart(startMs, yearsFromStart) {
  return startMs + yearsFromStart * MS_PER_YEAR
}

function formatYearsLabel(yearPreset) {
  const years = yearPreset?.years ?? 1
  if (years === 1) return '1 year'
  if (Number.isInteger(years)) return `${years} years`
  return yearPreset?.label ?? `${years} years`
}

function formatMagPhrase(minMagnitude) {
  if (minMagnitude <= 2.5) return 'magnitude 2.5 and above'
  return `magnitude ${minMagnitude} and above`
}

function averageMagForBand(events, band, startMs) {
  const innerMs = band.inner === 0 ? startMs - 1 : msAtYearsFromStart(startMs, band.inner)
  const outerMs = msAtYearsFromStart(startMs, band.outer)
  const mags = events
    .filter(
      e =>
        Number.isFinite(e.time) &&
        Number.isFinite(e.mag) &&
        e.time > innerMs &&
        e.time <= outerMs,
    )
    .map(e => e.mag)
  if (!mags.length) return null
  return mags.reduce((sum, mag) => sum + mag, 0) / mags.length
}

function LoadingDots({ label = 'Loading period data from the USGS catalog' }) {
  return (
    <p className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
      <span>{label}</span>
      <span className="eq-loading-dots inline-flex w-[1.25rem]" aria-hidden>
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </p>
  )
}

function OutputMetric({ label, value, highlight = false }) {
  return (
    <div className="rounded-md border border-[#2a2a2a] bg-[#111] px-3 py-2">
      <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      <p
        className={`mt-0.5 font-mono text-[11px] tabular-nums ${highlight ? 'text-[#ff9348]' : 'text-white'}`}
      >
        {value}
      </p>
    </div>
  )
}

export function TemporalActivityGuide({
  temporalAnnular,
  temporalPeriodQuality,
  yearPreset,
  activeMaxRadiusMiles,
  minMagnitude,
  summary,
  events = [],
  startDate,
  loading,
  hasTemporalAnalytics,
  dataQuality,
}) {
  const startMs = startDate?.getTime?.() ?? 0

  const bandsWithMag = useMemo(() => {
    if (!temporalAnnular?.length || !startMs) return []
    return temporalAnnular.map(band => ({
      ...band,
      avgMag: averageMagForBand(events, band, startMs),
    }))
  }, [temporalAnnular, events, startMs])

  if (loading) {
    return <LoadingDots />
  }

  if (dataQuality?.level === 'none') {
    return (
      <div className="space-y-2">
        <p className="font-mono text-[11px] leading-relaxed text-ink-secondary">
          No events match your filters — temporal modeling needs at least one catalog event.
        </p>
        <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
          Try lowering magnitude, widening radius, or choosing a shorter timeline in the sidebar.
        </p>
      </div>
    )
  }

  if (!hasTemporalAnalytics) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-[11px] leading-relaxed text-ink-secondary">
          Temporal period analysis needs a specific location.
        </p>
        <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
          Enter an address or use current location in the sidebar, then run this analysis again.
        </p>
      </div>
    )
  }

  if (!bandsWithMag.length) {
    return (
      <p className="font-mono text-[10px] text-ink-faint">No period bands available for this scope.</p>
    )
  }

  const peak = bandsWithMag.reduce(
    (best, band) => (band.count > (best?.count ?? -1) ? band : best),
    null,
  )
  const quietest = bandsWithMag.reduce(
    (best, band) => (band.count < (best?.count ?? Infinity) ? band : best),
    null,
  )
  const total = summary?.totalEvents ?? bandsWithMag.reduce((sum, b) => sum + b.count, 0)
  const yearsText = formatYearsLabel(yearPreset)
  const magPhrase = formatMagPhrase(minMagnitude)

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] leading-relaxed text-white">
        In the last {yearsText}, at {magPhrase}, within {activeMaxRadiusMiles.toLocaleString()} miles
        — {total.toLocaleString()} earthquakes recorded.
        {peak ? (
          <>
            {' '}
            The busiest period was{' '}
            <span className="text-[#ff9348]">{peak.label}</span> with{' '}
            {peak.count.toLocaleString()} earthquakes
            {peak.avgMag != null ? (
              <>
                {' '}
                (average magnitude{' '}
                <span className="text-[#ff9348]">M{peak.avgMag.toFixed(1)}</span>)
              </>
            ) : null}
            .
          </>
        ) : null}
      </p>

      {temporalPeriodQuality?.message ? (
        <p
          className={`rounded-md border px-3 py-2 font-mono text-[10px] leading-relaxed ${
            temporalPeriodQuality.level === 'saturated'
              ? 'border-command-watch/40 bg-command-watch/10 text-command-watch'
              : 'border-[#333] bg-[#111] text-ink-faint'
          }`}
        >
          {temporalPeriodQuality.message}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <OutputMetric label="Total events" value={total.toLocaleString()} />
        <OutputMetric
          label="Busiest period"
          value={peak ? `${peak.count.toLocaleString()} evt` : '—'}
          highlight
        />
        <OutputMetric
          label="Quietest period"
          value={quietest ? `${quietest.count.toLocaleString()} evt` : '—'}
        />
      </div>

      <div>
        <p className="section-label-sm mb-2">
          Period breakdown
        </p>
        <ul className="space-y-1.5">
          {bandsWithMag.map(band => {
            const isPeak = peak?.label === band.label
            return (
              <li
                key={band.label}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                  isPeak
                    ? 'border-[#ff9348]/35 bg-[#ff9348]/8'
                    : 'border-[#2a2a2a] bg-[#0d0d0d]'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] text-white">{band.label}</p>
                  <p className="font-mono text-[9px] text-ink-faint">
                    {Number(band.densityPerYear).toFixed(1)} events / yr
                    {band.avgMag != null ? ` · avg M${band.avgMag.toFixed(1)}` : ''}
                  </p>
                </div>
                <p
                  className={`shrink-0 font-mono text-[11px] tabular-nums ${
                    isPeak ? 'text-[#ff9348]' : 'text-ink-secondary'
                  }`}
                >
                  {band.count.toLocaleString()}
                </p>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="font-mono text-[9px] leading-relaxed text-ink-faint">
        Compare periods to spot clusters or quiet stretches. If counts look identical, raise magnitude
        or shorten the timeline — the USGS catalog cap can equalize dense regions.
      </p>
    </div>
  )
}

function GuideOutput({ analysisTypeId, analysisType, ...guideProps }) {
  if (!analysisTypeId || !analysisType) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <p className="font-mono text-[11px] text-ink-secondary">Select an analysis type on the left</p>
        <p className="max-w-sm font-mono text-[10px] leading-relaxed text-ink-faint">
          Pick a model, then adjust timeline and magnitude in the sidebar to update results.
        </p>
      </div>
    )
  }

  switch (analysisType.id) {
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

export default function EarthquakeStatDigestPanel({
  open,
  expanded,
  onExpandedChange,
  onClose,
  center,
  loading,
  truncated = false,
  yearPreset,
  globalAnalysis = false,
  hasTemporalAnalytics,
  activeMaxRadiusMiles,
  minMagnitude,
  summary,
  events = [],
  temporalAnnular,
  dataQuality,
}) {
  const [analysisTypeId, setAnalysisTypeId] = useState(null)

  const analysisType = useMemo(
    () => DIGEST_ANALYSIS_TYPES.find(type => type.id === analysisTypeId) ?? null,
    [analysisTypeId],
  )

  const { startDate } = useMemo(
    () => dateRangeForYears(yearPreset?.years ?? 5),
    [yearPreset?.years],
  )

  const temporalPeriodQuality = useMemo(
    () => assessTemporalPeriodQuality(temporalAnnular, { truncated }),
    [temporalAnnular, truncated],
  )

  const filterChip = globalAnalysis
    ? `${formatYearsLabel(yearPreset)} · ${formatMagPhrase(minMagnitude)}`
    : `${formatYearsLabel(yearPreset)} · ${activeMaxRadiusMiles} mi · ${formatMagPhrase(minMagnitude)}`

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="stat-digest"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: expanded ? 'auto' : 32, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="eq-stat-digest flex flex-col shrink-0 overflow-hidden border-t border-[#222] bg-[#080808]/95 backdrop-blur-md"
        >
          <div className="eq-stat-digest__header flex shrink-0 items-center gap-2 border-b border-[#222] px-3 py-2">
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              className="font-mono text-[10px] text-ink-faint transition hover:text-white"
              aria-label={expanded ? 'Minimize panel' : 'Expand panel'}
            >
              {expanded ? '▾' : '▴'}
            </button>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
              Statistical Digestion
            </p>
            <span className="hidden truncate font-mono text-[9px] text-ink-faint sm:inline">
              {filterChip}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[12px] leading-none text-ink-faint transition hover:text-white"
                aria-label="Close statistical digestion"
              >
                ×
              </button>
            </div>
          </div>

          {expanded ? (
            <div className="eq-stat-digest__body eq-stat-digest__split min-h-0 flex-1">
              <aside className="eq-stat-digest__controls sleek-scrollbar min-h-0 overflow-y-auto overscroll-contain border-r border-[#222] p-3">
                <p className="section-label-sm mb-2">
                  Analysis type
                </p>
                <div className="space-y-1.5">
                  {DIGEST_ANALYSIS_TYPES.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setAnalysisTypeId(type.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        analysisTypeId === type.id
                          ? 'border-[#ff9348]/45 bg-[#ff9348]/10'
                          : 'border-[#2a2a2a] bg-[#0d0d0d] hover:border-[#444]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] text-white">{type.label}</p>
                      </div>
                      <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
                        {type.description}
                      </p>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="eq-stat-digest__guide sleek-scrollbar min-h-0 overflow-y-auto overscroll-contain p-3">
                {analysisType ? (
                  <p className="mb-3 font-mono text-[10px] text-ink-faint">
                    <span className="text-white">{analysisType.label}</span>
                    <span className="text-ink-muted"> · </span>
                    {filterChip}
                  </p>
                ) : null}

                <GuideOutput
                  analysisTypeId={analysisTypeId}
                  analysisType={analysisType}
                  center={center}
                  temporalAnnular={temporalAnnular}
                  temporalPeriodQuality={temporalPeriodQuality}
                  yearPreset={yearPreset}
                  activeMaxRadiusMiles={activeMaxRadiusMiles}
                  minMagnitude={minMagnitude}
                  summary={summary}
                  events={events}
                  startDate={startDate}
                  loading={loading}
                  hasTemporalAnalytics={hasTemporalAnalytics}
                  globalAnalysis={globalAnalysis}
                  dataQuality={dataQuality}
                />
              </main>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onExpandedChange(true)}
              className="flex w-full items-center justify-center py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint transition hover:text-[#ff9348]"
            >
              Statistical Digestion · Guided modeling
            </button>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
