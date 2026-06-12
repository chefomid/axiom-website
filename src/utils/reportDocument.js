import { findNearestFault } from '../services/faultLines'
import {
  computeDepthBreakdown,
  computeMagnitudeDistribution,
  computeReturnPeriods,
  formatReturnPeriod,
} from './earthquakeModeling'
import {
  buildReportNarrative,
  formatReportDate,
  REPORT_DEPTH_PRESETS,
} from './earthquakeReport'

export const PREPARED_BY = 'AXIOM Property & Casualty'
export const DATA_SOURCE = 'USGS Earthquake Catalog'

const SECTION_TITLES = {
  'temporal-activity': 'How activity changed over time',
  'return-periods': 'How often larger earthquakes occur',
  'magnitude-distribution': 'Earthquake magnitudes in this area',
  'depth-breakdown': 'Earthquake depths',
  'nearest-fault': 'Nearest mapped fault',
}

const DISCLAIMER =
  'Past earthquake activity does not predict when or where future earthquakes will occur. ' +
  'This report is for general awareness, not engineering, insurance, or emergency planning decisions.'

function formatYearsLabel(yearPreset) {
  const years = yearPreset?.years ?? 1
  if (years === 1) return '1 year'
  if (Number.isInteger(years)) return `${years} years`
  return yearPreset?.label ?? `${years} years`
}

function formatMagPhrase(minMagnitude) {
  if (minMagnitude <= 2.5) return 'M2.5+'
  return `M${minMagnitude}+`
}

function tableFromRows(title, unit, rows) {
  if (!rows?.length) return null
  return {
    title,
    unit,
    columns: ['Band', unit ? `Value (${unit})` : 'Value'],
    rows: rows.map(r => ({
      label: r.label,
      value: formatTableValue(r.value),
      rawValue: r.value,
    })),
  }
}

function formatTableValue(value) {
  if (!Number.isFinite(value)) return '-'
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  if (value >= 100) return String(Math.round(value))
  if (value >= 10) return value.toFixed(1)
  if (value >= 1) return value.toFixed(1)
  return value.toFixed(2)
}

function annularTableRows(data) {
  if (!data?.length) return []
  return data.map(row => ({
    label: `${row.label} mi`,
    value: Number(row.densityPer1000SqMiPerYear ?? 0),
  }))
}

function temporalTableRows(data) {
  if (!data?.length) return []
  return data.map(row => ({
    label: String(row.label ?? ''),
    value: Number(row.count ?? 0),
  }))
}

function magnitudeTableRows(events, minMagnitude) {
  const distribution = computeMagnitudeDistribution(events, minMagnitude)
  return distribution.bins.map(b => ({ label: b.label, value: b.count }))
}

function buildTemporalSection(ctx) {
  const {
    temporalAnnular,
    temporalPeriodQuality,
    yearPreset,
    activeMaxRadiusMiles,
    minMagnitude,
    summary,
    hasTemporalAnalytics,
  } = ctx

  if (!hasTemporalAnalytics) {
    return {
      id: 'temporal-activity',
      title: SECTION_TITLES['temporal-activity'],
      narrative: [
        'Temporal period analysis needs a specific location. Enter an address or use current location, then run this analysis again.',
      ],
    }
  }
  if (!temporalAnnular?.length) {
    return {
      id: 'temporal-activity',
      title: SECTION_TITLES['temporal-activity'],
      narrative: ['No period bands available for this scope.'],
    }
  }

  const peak = temporalAnnular.reduce(
    (best, band) => (band.count > (best?.count ?? -1) ? band : best),
    null,
  )
  const yearsText = formatYearsLabel(yearPreset)
  const total = summary?.totalEvents ?? temporalAnnular.reduce((sum, b) => sum + b.count, 0)

  const narrative = [
    `In the last ${yearsText}, within ${activeMaxRadiusMiles.toLocaleString()} miles at ${formatMagPhrase(minMagnitude)}, ${total.toLocaleString()} earthquakes were recorded.${
      peak ? ` The busiest period was ${peak.label} (${peak.count.toLocaleString()} events).` : ''
    }`,
  ]
  if (temporalPeriodQuality?.message) narrative.push(temporalPeriodQuality.message)

  return {
    id: 'temporal-activity',
    title: SECTION_TITLES['temporal-activity'],
    narrative,
    metrics: [
      { id: 'total', label: 'Total events', value: total.toLocaleString() },
      { id: 'peak-period', label: 'Busiest period', value: peak?.label ?? '-' },
      { id: 'peak-count', label: 'Peak count', value: peak ? peak.count.toLocaleString() : '-' },
    ],
    table: tableFromRows('Activity by time period', 'events', temporalTableRows(temporalAnnular)),
  }
}

function buildReturnPeriodsSection(ctx) {
  const { events, yearPreset, activeMaxRadiusMiles, minMagnitude, globalAnalysis } = ctx
  const yearsInRange = yearPreset?.years ?? 5
  const periods = computeReturnPeriods(events, yearsInRange)
  const m5 = periods.find(p => p.threshold === 5)
  const m6 = periods.find(p => p.threshold === 6)
  const yearsText = formatYearsLabel(yearPreset)
  const radiusPhrase = globalAnalysis ? 'in this scope' : `within ${activeMaxRadiusMiles.toLocaleString()} miles`

  let lead = `In the last ${yearsText}, ${radiusPhrase}, the catalog recorded ${m5?.count.toLocaleString() ?? 0} earthquakes at M5.0 or above.`
  if (m5?.returnPeriodYears != null) {
    lead += ` About one every ${formatReturnPeriod(m5.returnPeriodYears)} on average.`
  }
  if (m6?.count > 0) {
    lead += ` M6.0+ count: ${m6.count.toLocaleString()} (${formatReturnPeriod(m6.returnPeriodYears)} between events).`
  }

  return {
    id: 'return-periods',
    title: SECTION_TITLES['return-periods'],
    narrative: [
      lead,
      `Return periods assume a steady rate over ${yearsText} at ${formatMagPhrase(minMagnitude)}. They describe catalog history, not forecasts.`,
    ],
    metrics: [
      { id: 'm5-return', label: 'M5+ return period', value: formatReturnPeriod(m5?.returnPeriodYears) },
      { id: 'm6-return', label: 'M6+ return period', value: formatReturnPeriod(m6?.returnPeriodYears) },
    ],
  }
}

function buildMagnitudeSection(ctx) {
  const { events, minMagnitude } = ctx
  const distribution = computeMagnitudeDistribution(events, minMagnitude)
  const dominant = distribution.dominant

  return {
    id: 'magnitude-distribution',
    title: SECTION_TITLES['magnitude-distribution'],
    narrative: [
      `Of ${distribution.total.toLocaleString()} earthquakes in scope, the most common band is ${dominant?.label ?? '-'}${
        dominant ? ` (${dominant.count.toLocaleString()} events, ${dominant.percent.toFixed(0)}%).` : '.'
      }`,
      'Lower magnitudes are detected more reliably near populated areas. A heavy small-event tail often reflects catalog completeness, not necessarily higher hazard.',
    ],
    metrics: [
      { id: 'mag-total', label: 'Total events', value: distribution.total.toLocaleString() },
      { id: 'mag-dominant', label: 'Dominant band', value: dominant?.label ?? '-', highlight: true },
      { id: 'mag-share', label: 'Largest share', value: dominant ? `${dominant.percent.toFixed(0)}%` : '-' },
    ],
    table: tableFromRows('Magnitude distribution', 'events', magnitudeTableRows(events, minMagnitude)),
  }
}

function buildDepthSection(ctx) {
  const breakdown = computeDepthBreakdown(ctx.events)
  if (!breakdown.hasDepthData) {
    return {
      id: 'depth-breakdown',
      title: SECTION_TITLES['depth-breakdown'],
      narrative: ['Depth data is unavailable for events in this scope.'],
    }
  }
  const dominant = breakdown.dominant
  return {
    id: 'depth-breakdown',
    title: SECTION_TITLES['depth-breakdown'],
    narrative: [
      `Among ${breakdown.total.toLocaleString()} events with depth reported, ${dominant?.label ?? '-'} events dominate${
        dominant ? ` (${dominant.count.toLocaleString()}, ${dominant.percent.toFixed(0)}%).` : '.'
      }`,
      'Shallow earthquakes (<35 km) are typically felt more strongly at the surface.',
    ],
    table: tableFromRows(
      'Depth bands',
      'events',
      breakdown.bands.map(b => ({ label: b.label, value: b.count })),
    ),
  }
}

function buildNearestFaultSection(ctx) {
  const { center, globalAnalysis, hasTemporalAnalytics } = ctx
  if (globalAnalysis || !hasTemporalAnalytics || !center) {
    return {
      id: 'nearest-fault',
      title: SECTION_TITLES['nearest-fault'],
      narrative: [
        'Nearest-fault analysis needs a specific location. Global and country overviews skip fault distance.',
      ],
    }
  }
  const nearest = findNearestFault(center)
  if (!nearest) {
    return {
      id: 'nearest-fault',
      title: SECTION_TITLES['nearest-fault'],
      narrative: ['Fault line data is unavailable for this location.'],
    }
  }
  const distanceText =
    nearest.distanceMiles < 1
      ? `${(nearest.distanceMiles * 5280).toFixed(0)} ft`
      : `${nearest.distanceMiles.toFixed(1)} mi`

  return {
    id: 'nearest-fault',
    title: SECTION_TITLES['nearest-fault'],
    narrative: [
      `The closest mapped fault is ${nearest.displayName}, about ${distanceText} away${nearest.region ? ` (${nearest.region})` : ''}.`,
    ],
    metrics: [
      { id: 'fault-name', label: 'Nearest fault', value: nearest.displayName, highlight: true },
      { id: 'fault-dist', label: 'Distance', value: distanceText },
    ],
  }
}

function buildAnalysisSection(sectionId, ctx) {
  switch (sectionId) {
    case 'temporal-activity':
      return buildTemporalSection(ctx)
    case 'return-periods':
      return buildReturnPeriodsSection(ctx)
    case 'magnitude-distribution':
      return buildMagnitudeSection(ctx)
    case 'depth-breakdown':
      return buildDepthSection(ctx)
    case 'nearest-fault':
      return buildNearestFaultSection(ctx)
    default:
      return null
  }
}

function buildKpis({ summary, narrative, globalAnalysis, temporalAnnular, events, yearPreset, ctx }) {
  const strongestValue =
    summary?.maxEvent?.mag != null
      ? globalAnalysis
        ? `M${summary.maxEvent.mag.toFixed(1)}`
        : `M${summary.maxEvent.mag.toFixed(1)} · ${summary.maxEvent.dist?.toFixed(0) ?? '-'} mi`
      : '-'

  const kpis = [
    {
      id: 'total-events',
      label: 'Total events',
      value: (summary?.totalEvents ?? 0).toLocaleString(),
      highlight: true,
    },
    { id: 'strongest', label: 'Strongest event', value: strongestValue },
    {
      id: 'avg-per-year',
      label: 'Average / year',
      value:
        narrative.eventsPerYear >= 10
          ? Math.round(narrative.eventsPerYear).toLocaleString()
          : narrative.eventsPerYear.toFixed(1),
    },
  ]

  if (!globalAnalysis && summary?.peakDensityPer1000SqMiPerYear != null) {
    kpis.push({
      id: 'peak-density',
      label: 'Peak density',
      value: `${summary.peakDensityPer1000SqMiPerYear.toFixed(1)} / yr per 1k sq mi`,
    })
  }

  const peak = temporalAnnular?.length
    ? temporalAnnular.reduce((best, band) => (band.count > (best?.count ?? -1) ? band : best), null)
    : null
  if (peak?.label) {
    kpis.push({ id: 'peak-period', label: 'Peak period', value: peak.label })
  }

  const yearsInRange = yearPreset?.years ?? 5
  const m5 = computeReturnPeriods(events, yearsInRange, [5]).find(p => p.threshold === 5)
  if (m5?.returnPeriodYears != null && !globalAnalysis) {
    kpis.push({
      id: 'm5-frequency',
      label: 'M5+ frequency',
      value: formatReturnPeriod(m5.returnPeriodYears),
    })
  }

  const nearest = ctx.center && !globalAnalysis ? findNearestFault(ctx.center) : null
  if (nearest) {
    const distanceText =
      nearest.distanceMiles < 1
        ? `${(nearest.distanceMiles * 5280).toFixed(0)} ft`
        : `${nearest.distanceMiles.toFixed(1)} mi`
    kpis.push({ id: 'nearest-fault', label: 'Nearest fault', value: distanceText })
  }

  return kpis.slice(0, 6)
}

function buildCatalogTables({ config, globalAnalysis, hasTemporalAnalytics, annular, temporalAnnular, events, minMagnitude, dataQuality }) {
  if (!config?.includeCharts || dataQuality?.level === 'none') return []

  const tables = []
  if (!globalAnalysis && annular?.length) {
    const rows = annularTableRows(annular)
    const t = tableFromRows('Earthquake density by distance band', 'events / yr / 1k sq mi', rows)
    if (t) tables.push({ id: 'annular', ...t })
  }
  if (!globalAnalysis && hasTemporalAnalytics && temporalAnnular?.length) {
    const t = tableFromRows('Activity by time period', 'events', temporalTableRows(temporalAnnular))
    if (t) tables.push({ id: 'temporal', ...t })
  }
  const hasMagnitudeSection = config.sectionIds?.includes('magnitude-distribution')
  if (!hasMagnitudeSection) {
    const t = tableFromRows(
      'Magnitude distribution',
      'events',
      magnitudeTableRows(events, minMagnitude),
    )
    if (t) tables.push({ id: 'magnitude-catalog', ...t })
  }
  return tables
}

/**
 * @param {object} params, analytics + config from EarthquakeReportViewer
 * @returns {import('./reportDocument.types').ReportDocument}
 */
export function buildReportDocument({
  config,
  locationLabel,
  summary,
  events = [],
  yearPreset,
  minMagnitude,
  globalAnalysis,
  hasTemporalAnalytics,
  temporalAnnular,
  temporalPeriodQuality,
  annular,
  dataQuality,
}) {
  const depthPreset = REPORT_DEPTH_PRESETS.find(p => p.id === config?.depthId) ?? REPORT_DEPTH_PRESETS[1]
  const depthLabel = depthPreset.label
  const scope = config?.scope ?? 'location'
  const sectionIds = config?.sectionIds ?? []

  const narrative = buildReportNarrative({
    scope,
    locationLabel,
    yearPreset,
    minMagnitude,
    activeMaxRadiusMiles: config?.maxRadiusMiles ?? 250,
    globalAnalysis,
    summary,
    events,
  })

  const ctx = {
    events,
    yearPreset,
    minMagnitude,
    globalAnalysis,
    hasTemporalAnalytics,
    temporalAnnular,
    temporalPeriodQuality,
    activeMaxRadiusMiles: config?.maxRadiusMiles ?? 250,
    center: config?.centerOverride,
    summary,
  }

  const parameters = [
    { label: 'Location', value: locationLabel },
    ...(globalAnalysis
      ? []
      : [{ label: 'Radius', value: `${(config?.maxRadiusMiles ?? 250).toLocaleString()} miles` }]),
    { label: 'Lookback period', value: formatYearsLabel(yearPreset) },
    { label: 'Minimum magnitude', value: formatMagPhrase(minMagnitude) },
    { label: 'Data source', value: DATA_SOURCE },
    { label: 'Report depth', value: depthLabel },
  ]

  const kpis = buildKpis({
    summary,
    narrative,
    globalAnalysis,
    temporalAnnular,
    events,
    yearPreset,
    ctx,
  })

  const analysisSections = sectionIds
    .map(id => buildAnalysisSection(id, ctx))
    .filter(Boolean)

  const catalogTables = buildCatalogTables({
    config,
    globalAnalysis,
    hasTemporalAnalytics,
    annular,
    temporalAnnular,
    events,
    minMagnitude,
    dataQuality,
  })

  const noData = dataQuality?.level === 'none'

  return {
    meta: {
      title: 'Seismic Activity Report',
      type: `${depthLabel} report`,
      location: locationLabel,
      generatedDate: formatReportDate(),
      preparedBy: PREPARED_BY,
      dataSource: DATA_SOURCE,
    },
    parameters,
    executiveSummary: {
      headline: narrative.headline,
      meaning: narrative.meaning,
      bullets: narrative.bullets,
      activityLevel: narrative.activityLevel.label,
    },
    kpis,
    catalogTables,
    analysisSections,
    methodology: {
      source: DATA_SOURCE,
      disclaimer: DISCLAIMER,
      dataQualityNote:
        dataQuality?.message && dataQuality.level !== 'ok' && dataQuality.level !== 'none'
          ? dataQuality.message
          : null,
    },
    noData,
    noDataMessage: dataQuality?.message ?? 'No events match these filters for the selected focus.',
  }
}

/**
 * @param {ReturnType<typeof buildReportDocument>} doc
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateReportDocument(doc) {
  const errors = []

  if (!doc?.meta?.title) errors.push('Report title is missing.')
  if (!doc?.meta?.location) errors.push('Report location is missing.')
  if (!doc?.meta?.generatedDate) errors.push('Generated date is missing.')
  if (!doc?.meta?.preparedBy) errors.push('Prepared-by field is missing.')
  if (!doc?.meta?.dataSource) errors.push('Data source is missing.')

  if (doc?.noData) {
    if (!doc.noDataMessage) errors.push('No-data message is missing.')
    return { ok: errors.length === 0, errors }
  }

  if (!doc?.executiveSummary?.headline) errors.push('Executive summary headline is missing.')
  if (!doc?.kpis?.length) errors.push('At least one KPI is required.')
  if (!doc?.parameters?.length) errors.push('Search parameters table is empty.')
  if (!doc?.methodology?.disclaimer) errors.push('Disclaimer is missing.')

  const sectionIds = new Set()
  for (const section of doc?.analysisSections ?? []) {
    if (sectionIds.has(section.id)) {
      errors.push(`Duplicate section: ${section.id}`)
    }
    sectionIds.add(section.id)
    if (section.table && !section.table.unit) {
      errors.push(`Section "${section.title}" table is missing units.`)
    }
  }

  for (const table of doc?.catalogTables ?? []) {
    if (!table.unit) errors.push(`Catalog table "${table.title}" is missing units.`)
    if (!table.rows?.length) errors.push(`Catalog table "${table.title}" has no rows.`)
  }

  const pageEstimate =
    1 +
    1 +
    (doc.catalogTables?.length ? 1 : 0) +
    Math.ceil((doc.analysisSections?.length ?? 0) / 2) +
    1
  if (pageEstimate > 12) errors.push('Report exceeds reasonable page budget (12 pages).')

  return { ok: errors.length === 0, errors }
}
