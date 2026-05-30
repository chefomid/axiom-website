const PLATE_LABELS = {
  'PA-NA': 'Pacific–North America plate boundary',
  'NA-PA': 'North America–Pacific plate boundary',
  'NA/PA': 'North America–Pacific plate boundary',
  'CA-NA': 'Cocos–North America plate boundary',
  'NA-CA': 'North America–Cocos plate boundary',
  'CA/NA': 'Cocos–North America plate boundary',
  'NA-AF': 'North America–Africa plate boundary',
  'NA-EU': 'North America–Eurasia plate boundary',
  'NA-SA': 'North America–South America plate boundary',
  'PA-AN': 'Pacific–Antarctica plate boundary',
  'AN-NZ': 'Antarctica–Nazca plate boundary',
  'CO-NA': 'Caribbean–North America plate boundary',
  'CO/NA': 'Caribbean–North America plate boundary',
  'EU-AF': 'Eurasia–Africa plate boundary',
  'EU/AF': 'Eurasia–Africa plate boundary',
  'EU\\AF': 'Eurasia–Africa plate boundary',
  'IN-SO': 'India–Somalia plate boundary',
  'AU-SO': 'Australia–Somalia plate boundary',
  'SO-AN': 'Somalia–Antarctica plate boundary',
  'AF-AN': 'Africa–Antarctica plate boundary',
  'PA-AU': 'Pacific–Australia plate boundary',
  'AU-AN': 'Australia–Antarctica plate boundary',
  'JF\\NA': 'Juan de Fuca–North America plate boundary',
  'OK/NA': 'Okhotsk–North America plate boundary',
  'OK-NA': 'Okhotsk–North America plate boundary',
}

const PLATE_NAMES = {
  PA: 'Pacific',
  NA: 'North America',
  CA: 'Cocos',
  SA: 'South America',
  AF: 'Africa',
  EU: 'Eurasia',
  AN: 'Antarctica',
  AU: 'Australia',
  SO: 'Somalia',
  IN: 'India',
  NZ: 'Nazca',
  CO: 'Caribbean',
  JF: 'Juan de Fuca',
  OK: 'Okhotsk',
  TO: 'Tonga',
  KE: 'Kermadec',
  SC: 'Scotia',
  AM: 'Amur',
  PS: 'Philippine Sea',
}

function parsePlatePair(code) {
  const normalized = String(code ?? '').replace(/[\\/]/g, '-')
  const parts = normalized.split('-').filter(Boolean)
  if (parts.length >= 2) return [parts[0], parts[1]]
  return null
}

export function formatPlateBoundaryLabel(code) {
  if (!code) return 'Unknown plate boundary'
  if (PLATE_LABELS[code]) return PLATE_LABELS[code]

  const pair = parsePlatePair(code)
  if (pair) {
    const [a, b] = pair
    const nameA = PLATE_NAMES[a] ?? a
    const nameB = PLATE_NAMES[b] ?? b
    return `${nameA}–${nameB} plate boundary`
  }

  return `${code} plate boundary`
}

/** Human-readable interval between recurring events (years input = average years between events). */
export function formatReturnPeriod(years) {
  if (years == null) return 'No events in window'

  if (years >= 100) return `${Math.round(years)} years`
  if (years >= 10) return `${Math.round(years)} years`
  if (years >= 2) return `${Math.round(years)} years`
  if (years >= 1) {
    const rounded = Math.round(years * 10) / 10
    return rounded === 1 ? '1 year' : `${rounded} years`
  }

  const days = years * 365.25
  if (days >= 45) {
    const months = Math.round(years * 12)
    return months === 1 ? 'about 1 month' : `about ${months} months`
  }
  if (days >= 7) {
    const weeks = Math.round(days / 7)
    return weeks === 1 ? 'about 1 week' : `about ${weeks} weeks`
  }
  if (days >= 1) {
    const roundedDays = Math.max(1, Math.round(days))
    return roundedDays === 1 ? 'about 1 day' : `about ${roundedDays} days`
  }

  return 'less than 1 day apart'
}

export function computeReturnPeriods(events, yearsInRange, thresholds = [5, 6]) {
  const safeYears = Math.max(yearsInRange, 1 / 365)
  const validEvents = events.filter(e => Number.isFinite(e.mag))

  return thresholds.map(threshold => {
    const count = validEvents.filter(e => e.mag >= threshold).length
    const ratePerYear = count / safeYears
    return {
      threshold,
      count,
      ratePerYear,
      returnPeriodYears: count > 0 ? safeYears / count : null,
    }
  })
}

function magnitudeBinLabel(min, max) {
  if (max == null) return `M${min}+`
  return `M${min}–${max}`
}

export function computeMagnitudeDistribution(events, minMagnitude = 2.5) {
  const bins = [
    { min: minMagnitude, max: 3, label: magnitudeBinLabel(minMagnitude, 3) },
    { min: 3, max: 4, label: 'M3–4' },
    { min: 4, max: 5, label: 'M4–5' },
    { min: 5, max: 6, label: 'M5–6' },
    { min: 6, max: null, label: 'M6+' },
  ]

  const validEvents = events.filter(e => Number.isFinite(e.mag))
  const total = validEvents.length

  const distribution = bins.map(bin => {
    const count = validEvents.filter(e => {
      if (e.mag < bin.min) return false
      if (bin.max == null) return true
      return e.mag < bin.max
    }).length
    return {
      ...bin,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    }
  })

  const dominant = distribution.reduce(
    (best, bin) => (bin.count > (best?.count ?? -1) ? bin : best),
    null,
  )

  return { total, bins: distribution, dominant }
}

export function computeDepthBreakdown(events) {
  const bands = [
    { id: 'shallow', label: 'Shallow (<35 km)', min: 0, max: 35 },
    { id: 'intermediate', label: 'Intermediate (35–70 km)', min: 35, max: 70 },
    { id: 'deep', label: 'Deep (>70 km)', min: 70, max: null },
  ]

  const withDepth = events.filter(e => Number.isFinite(e.depth))
  const unknownCount = events.length - withDepth.length
  const total = withDepth.length

  const breakdown = bands.map(band => {
    const count = withDepth.filter(e => {
      if (e.depth < band.min) return false
      if (band.max == null) return true
      return e.depth < band.max
    }).length
    return {
      ...band,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    }
  })

  const dominant = breakdown.reduce(
    (best, band) => (band.count > (best?.count ?? -1) ? band : best),
    null,
  )

  return {
    total,
    unknownCount,
    hasDepthData: withDepth.length > 0,
    bands: breakdown,
    dominant,
  }
}
