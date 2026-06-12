import { useMemo } from 'react'

import { findNearestFault } from '../../services/faultLines'
import {
  computeDepthBreakdown,
  computeMagnitudeDistribution,
  computeReturnPeriods,
  formatReturnPeriod,
} from '../../utils/earthquakeModeling'

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

function formatRatePerYear(rate) {
  if (rate >= 10) return `${Math.round(rate)} per year`
  if (rate >= 1) return `${rate.toFixed(1)} per year`
  if (rate >= 0.1) return `${rate.toFixed(2)} per year`
  return `${rate.toFixed(2)} per year`
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

function NoEventsGuard({ dataQuality, loading }) {
  if (loading) return <LoadingDots />
  if (dataQuality?.level !== 'none') return null
  return (
    <div className="space-y-2">
      <p className="font-mono text-[11px] leading-relaxed text-ink-secondary">
        No events match your filters, this analysis needs at least one catalog event.
      </p>
      <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
        Try lowering magnitude, widening radius, or choosing a shorter timeline in the sidebar.
      </p>
    </div>
  )
}

export function ReturnPeriodsGuide({
  events = [],
  yearPreset,
  activeMaxRadiusMiles,
  minMagnitude,
  loading,
  dataQuality,
  globalAnalysis,
}) {
  const yearsInRange = yearPreset?.years ?? 5
  const periods = useMemo(
    () => computeReturnPeriods(events, yearsInRange),
    [events, yearsInRange],
  )

  const guard = NoEventsGuard({ dataQuality, loading })
  if (guard) return guard

  const yearsText = formatYearsLabel(yearPreset)
  const magPhrase = formatMagPhrase(minMagnitude)
  const m5 = periods.find(p => p.threshold === 5)
  const m6 = periods.find(p => p.threshold === 6)

  const radiusPhrase = globalAnalysis
    ? 'in this scope'
    : `within ${activeMaxRadiusMiles.toLocaleString()} miles`

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] leading-relaxed text-white">
        In the last {yearsText}, {radiusPhrase}, the catalog recorded{' '}
        {m5?.count.toLocaleString() ?? 0} earthquakes at{' '}
        <span className="text-[#ff9348]">M5.0 or above</span>
        {m5?.returnPeriodYears != null ? (
          <>
            {', '}
            {m5.ratePerYear >= 1 ? (
              <>
                about <span className="text-[#ff9348]">{formatRatePerYear(m5.ratePerYear)}</span>
                {' '}
                (<span className="text-[#ff9348]">{formatReturnPeriod(m5.returnPeriodYears)}</span>{' '}
                apart on average).
              </>
            ) : (
              <>
                about one every{' '}
                <span className="text-[#ff9348]">{formatReturnPeriod(m5.returnPeriodYears)}</span>{' '}
                on average.
              </>
            )}
          </>
        ) : (
          '.'
        )}
        {m6 && m6.count > 0 ? (
          <>
            {' '}
            For M6.0+, the count is {m6.count.toLocaleString()} (
            {formatReturnPeriod(m6.returnPeriodYears)} between events).
          </>
        ) : null}
      </p>

      {(m5?.count ?? 0) < 3 ? (
        <p className="rounded-md border border-[#333] bg-[#111] px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-faint">
          Few large events in this window, return periods are rough estimates, not forecasts.
          Widen the timeline or radius for a more stable rate.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <OutputMetric
          label="M5+ return period"
          value={formatReturnPeriod(m5?.returnPeriodYears)}
          highlight={m5?.count > 0}
        />
        <OutputMetric
          label="M6+ return period"
          value={formatReturnPeriod(m6?.returnPeriodYears)}
          highlight={m6?.count > 0}
        />
      </div>

      <div>
        <p className="section-label-sm mb-2">
          Threshold breakdown
        </p>
        <ul className="space-y-1.5">
          {periods.map(row => (
            <li
              key={row.threshold}
              className="flex items-center justify-between gap-3 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-white">M{row.threshold}.0+</p>
                <p className="font-mono text-[9px] text-ink-faint">
                  {row.ratePerYear.toFixed(2)} events / yr
                </p>
              </div>
              <p className="shrink-0 font-mono text-[11px] tabular-nums text-ink-secondary">
                {row.count.toLocaleString()} evt
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-[9px] leading-relaxed text-ink-faint">
        Return periods assume a steady rate over {yearsText} at {magPhrase}. They describe catalog
        history, not future earthquake timing.
      </p>
    </div>
  )
}

export function MagnitudeDistributionGuide({ events = [], minMagnitude, loading, dataQuality }) {
  const distribution = useMemo(
    () => computeMagnitudeDistribution(events, minMagnitude),
    [events, minMagnitude],
  )

  const guard = NoEventsGuard({ dataQuality, loading })
  if (guard) return guard

  const dominant = distribution.dominant

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] leading-relaxed text-white">
        Of {distribution.total.toLocaleString()} earthquakes in scope, the most common band is{' '}
        <span className="text-[#ff9348]">{dominant?.label ?? '-'}</span>
        {dominant ? (
          <>
            {' '}
            ({dominant.count.toLocaleString()} events, {dominant.percent.toFixed(0)}%).
          </>
        ) : null}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <OutputMetric label="Total events" value={distribution.total.toLocaleString()} />
        <OutputMetric
          label="Dominant band"
          value={dominant?.label ?? '-'}
          highlight
        />
        <OutputMetric
          label="Largest share"
          value={dominant ? `${dominant.percent.toFixed(0)}%` : '-'}
        />
      </div>

      <div>
        <p className="section-label-sm mb-2">
          Magnitude bins
        </p>
        <ul className="space-y-1.5">
          {distribution.bins.map(bin => {
            const isDominant = dominant?.label === bin.label
            return (
              <li
                key={bin.label}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                  isDominant
                    ? 'border-[#ff9348]/35 bg-[#ff9348]/8'
                    : 'border-[#2a2a2a] bg-[#0d0d0d]'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-white">{bin.label}</p>
                  <p className="font-mono text-[9px] text-ink-faint">{bin.percent.toFixed(1)}%</p>
                </div>
                <p
                  className={`shrink-0 font-mono text-[11px] tabular-nums ${
                    isDominant ? 'text-[#ff9348]' : 'text-ink-secondary'
                  }`}
                >
                  {bin.count.toLocaleString()}
                </p>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="font-mono text-[9px] leading-relaxed text-ink-faint">
        Lower magnitudes are detected more reliably near populated areas. A heavy small-event tail
        often reflects catalog completeness, not necessarily higher hazard.
      </p>
    </div>
  )
}

export function DepthBreakdownGuide({ events = [], loading, dataQuality }) {
  const breakdown = useMemo(() => computeDepthBreakdown(events), [events])

  const guard = NoEventsGuard({ dataQuality, loading })
  if (guard) return guard

  if (!breakdown.hasDepthData) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-[11px] leading-relaxed text-ink-secondary">
          Depth data is unavailable for events in this scope.
        </p>
        <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
          The USGS catalog includes depth for most events, try refetching or adjusting filters.
        </p>
      </div>
    )
  }

  const dominant = breakdown.dominant

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] leading-relaxed text-white">
        Among {breakdown.total.toLocaleString()} events with depth reported,{' '}
        <span className="text-[#ff9348]">{dominant?.label ?? '-'}</span> events dominate
        {dominant ? (
          <>
            {' '}
            ({dominant.count.toLocaleString()}, {dominant.percent.toFixed(0)}%).
          </>
        ) : null}
        {breakdown.unknownCount > 0 ? (
          <> {breakdown.unknownCount.toLocaleString()} events had no depth value.</>
        ) : null}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <OutputMetric label="With depth" value={breakdown.total.toLocaleString()} />
        <OutputMetric
          label="Dominant depth"
          value={dominant?.id === 'shallow' ? 'Shallow' : dominant?.id === 'intermediate' ? 'Intermediate' : dominant?.id === 'deep' ? 'Deep' : '-'}
          highlight
        />
        <OutputMetric
          label="Unknown depth"
          value={breakdown.unknownCount.toLocaleString()}
        />
      </div>

      <div>
        <p className="section-label-sm mb-2">
          Depth bands
        </p>
        <ul className="space-y-1.5">
          {breakdown.bands.map(band => {
            const isDominant = dominant?.id === band.id
            return (
              <li
                key={band.id}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                  isDominant
                    ? 'border-[#ff9348]/35 bg-[#ff9348]/8'
                    : 'border-[#2a2a2a] bg-[#0d0d0d]'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-white">{band.label}</p>
                  <p className="font-mono text-[9px] text-ink-faint">{band.percent.toFixed(1)}%</p>
                </div>
                <p
                  className={`shrink-0 font-mono text-[11px] tabular-nums ${
                    isDominant ? 'text-[#ff9348]' : 'text-ink-secondary'
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
        Shallow earthquakes (&lt;35 km) are typically felt more strongly at the surface. Deep events
        often relate to subduction zones far below the crust.
      </p>
    </div>
  )
}

export function NearestFaultGuide({ center, globalAnalysis, loading, hasTemporalAnalytics }) {
  const nearest = useMemo(() => (center ? findNearestFault(center) : null), [center])

  if (loading) {
    return <LoadingDots label="Loading fault line data" />
  }

  if (globalAnalysis || !hasTemporalAnalytics) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-[11px] leading-relaxed text-ink-secondary">
          Nearest-fault analysis needs a specific location.
        </p>
        <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
          Enter an address or use current location in the sidebar, global and country overviews
          skip fault distance.
        </p>
      </div>
    )
  }

  if (!nearest) {
    return (
      <p className="font-mono text-[10px] text-ink-faint">
        Fault line data is still loading or unavailable. Toggle fault lines on the map or retry.
      </p>
    )
  }

  const distanceText =
    nearest.distanceMiles < 1
      ? `${(nearest.distanceMiles * 5280).toFixed(0)} ft`
      : `${nearest.distanceMiles.toFixed(1)} mi`

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] leading-relaxed text-white">
        The closest mapped fault to this location is{' '}
        <span className="text-[#ff9348]">{nearest.displayName}</span>, about{' '}
        <span className="text-[#ff9348]">{distanceText}</span> away
        {nearest.region ? <> ({nearest.region})</> : null}.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <OutputMetric label="Nearest fault" value={nearest.displayName} highlight />
        <OutputMetric label="Distance" value={distanceText} />
      </div>

      {nearest.referenceUrl ? (
        <a
          href={nearest.referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[#ff9348]/35 bg-[#ff9348]/8 px-3 py-2 font-mono text-[10px] text-[#ff9348] transition hover:border-[#ff9348]/55 hover:text-white"
        >
          → {nearest.referenceSource ?? 'USGS'}: read more about {nearest.displayName}
        </a>
      ) : null}

      {nearest.source === 'named-fault' ? (
        <p className="rounded-md border border-[#333] bg-[#111] px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-faint">
          Named fault segments are simplified traces of major US systems. Distance is measured to
          the nearest point on that segment.
        </p>
      ) : (
        <p className="rounded-md border border-[#333] bg-[#111] px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-faint">
          No nearby named US fault matched, showing the closest PB2002 plate boundary (
          {nearest.rawCode || 'global'}). Use the link above to explore mapped faults in the{' '}
          <a
            href={nearest.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff9348] hover:text-white"
          >
            USGS Quaternary Fault database
          </a>
          .
        </p>
      )}

      <p className="font-mono text-[9px] leading-relaxed text-ink-faint">
        Proximity to a mapped fault does not predict when the next earthquake will occur. Use this
        for regional context alongside magnitude and recurrence analyses.
      </p>
    </div>
  )
}
