import { PRESET_OPTIONAL_ADDONS, batchLocationPrice, formatUsd, quoteLineItem } from '../services/propertyApi'

const ADDON_SET = new Set(PRESET_OPTIONAL_ADDONS)

function categoryLabel(catalog, categoryId) {
  return catalog?.categories?.find(c => c.id === categoryId)?.label ?? 'Data services'
}

function billableLineItems(lineItems) {
  return (lineItems ?? []).filter(item => {
    if (item.source_id === 'geocode_census') return false
    const price = item.user_price_usd ?? 0
    return item.billable !== false || price > 0
  })
}

function aggregateCoreByCategory(catalog, lineItems) {
  const groups = new Map()
  for (const item of billableLineItems(lineItems)) {
    if (ADDON_SET.has(item.source_id)) continue
    const src = catalog?.sources?.find(s => s.id === item.source_id)
    const label = categoryLabel(catalog, src?.category)
    groups.set(label, (groups.get(label) ?? 0) + (item.user_price_usd ?? 0))
  }
  return [...groups.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([label, amount]) => ({ label, amount: roundUsd(amount) }))
}

function addonLines(catalog, lineItems, selectedSources) {
  return (selectedSources ?? [])
    .filter(id => ADDON_SET.has(id))
    .map(id => {
      const item = lineItems?.find(row => row.source_id === id) ?? quoteLineItem(catalog, { line_items: lineItems }, id)
      if (!item) return null
      const price = item.user_price_usd ?? 0
      if (price <= 0 && !item.billable) return null
      return {
        label: item.label ?? id,
        amount: roundUsd(price),
      }
    })
    .filter(Boolean)
}

function roundUsd(value) {
  return Math.round(Number(value) * 100) / 100
}

function reconciliationLine(label, targetTotal, lineSum) {
  const delta = roundUsd(targetTotal - lineSum)
  if (Math.abs(delta) < 0.01) return null
  return {
    label,
    amount: delta,
    kind: delta < 0 ? 'discount' : 'adjustment',
  }
}

/**
 * Competitor-safe receipt: category groupings and add-on labels only, no vendor API costs or margins.
 */
export function buildSafeItemizedReceipt({
  catalog,
  presets,
  activePresetId,
  quote,
  selectedSources,
  batchQuote,
  scheduleMode = false,
}) {
  const preset = presets?.find(p => p.id === activePresetId)
  const presetLabel = preset?.label ?? 'Selected package'

  if (scheduleMode && batchQuote?.totals) {
    const n = batchQuote.totals.location_count ?? 0
    const sampleQuote = batchQuote.locations?.find(loc => loc.status === 'valid')?.quote
    const lineItems = sampleQuote?.line_items ?? []
    const lines = []

    lines.push({
      key: 'package',
      label: `${presetLabel} · ${n} location${n === 1 ? '' : 's'}`,
      amount: null,
      kind: 'section',
    })

    for (const row of aggregateCoreByCategory(catalog, lineItems)) {
      lines.push({
        key: `core-${row.label}`,
        label: row.label,
        amount: roundUsd(row.amount * n),
        kind: 'line',
      })
    }

    for (const row of addonLines(catalog, lineItems, selectedSources)) {
      lines.push({
        key: `addon-${row.label}`,
        label: row.label,
        amount: roundUsd(row.amount * n),
        kind: 'line',
      })
    }

    if (batchQuote.totals.volume_savings_usd > 0) {
      lines.push({
        key: 'volume-savings',
        label: `Volume savings (${Math.round((batchQuote.totals.volume_discount_rate ?? 0) * 100)}%)`,
        amount: -batchQuote.totals.volume_savings_usd,
        kind: 'discount',
      })
    }

    const lineSum = lines
      .filter(row => row.kind === 'line' || row.kind === 'discount')
      .reduce((sum, row) => sum + (row.amount ?? 0), 0)
    const reconcile = reconciliationLine('Batch platform adjustment', batchQuote.totals.user_price_usd, lineSum)
    if (reconcile) lines.push({ key: 'adjustment', ...reconcile })

    const locationLines = (batchQuote.locations ?? [])
      .filter(loc => loc.status === 'valid')
      .map(loc => ({
        key: `loc-${loc.row_index}`,
        label: loc.display_name ?? loc.address_input,
        amount: batchLocationPrice(loc),
      }))

    return {
      title: 'Batch estimate',
      lines,
      totalUsd: batchQuote.totals.user_price_usd,
      totalLabel: 'Schedule total',
      locationLines,
      footnote:
        'Per-location amounts include shared platform minimums and volume pricing. Vendor and API cost details are not shown.',
    }
  }

  const lineItems = quote?.line_items ?? []
  const lines = []

  lines.push({
    key: 'package',
    label: presetLabel,
    amount: null,
    kind: 'section',
  })

  for (const row of aggregateCoreByCategory(catalog, lineItems)) {
    lines.push({
      key: `core-${row.label}`,
      label: row.label,
      amount: row.amount,
      kind: 'line',
    })
  }

  for (const row of addonLines(catalog, lineItems, selectedSources)) {
    lines.push({
      key: `addon-${row.label}`,
      label: row.label,
      amount: row.amount,
      kind: 'line',
    })
  }

  const totalUsd = quote?.totals?.user_price_usd
  const lineSum = lines.filter(row => row.kind === 'line').reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const reconcile = reconciliationLine('Platform minimum adjustment', totalUsd, lineSum)
  if (reconcile) lines.push({ key: 'adjustment', ...reconcile })

  return {
    title: quote?.isFinal ? 'Final receipt' : 'Estimate',
    lines,
    totalUsd,
    totalLabel: quote?.isFinal ? 'Total charged' : 'Estimated total',
    locationLines: null,
    footnote: 'Summary pricing by data category. Vendor, API, and margin details are not shown.',
  }
}

export { formatUsd }
