import { PRESET_OPTIONAL_ADDONS, batchLocationPrice, formatUsd } from '../services/propertyApi'
import {
  isLicensedReceiptLine,
  licensedReceiptLineAmount,
} from './receiptLicensedLines'

const ADDON_SET = new Set(PRESET_OPTIONAL_ADDONS)

function billableLineItems(lineItems) {
  return (lineItems ?? []).filter(item => {
    if (item.source_id === 'geocode_census') return false
    if (item.billable === false) return false
    return true
  })
}

function roundUsd(value) {
  return Math.round(Number(value) * 100) / 100
}

function buildTransparentPricingLines(lineItems, totals, { multiplier = 1 } = {}) {
  const lines = []
  const items = billableLineItems(lineItems)

  for (const item of items) {
    if (ADDON_SET.has(item.source_id)) continue
    const apiCost = Number(item.api_cost_usd ?? 0)
    if (apiCost > 0) {
      if (!isLicensedReceiptLine(item)) continue
      const amount = roundUsd(licensedReceiptLineAmount(item) * multiplier)
      lines.push({
        key: `licensed-${item.source_id}`,
        label: `${item.label} · licensed API`,
        amount,
        kind: 'line',
      })
      continue
    }
    lines.push({
      key: `public-${item.source_id}`,
      label: `${item.label} · public feed`,
      amount: 0,
      kind: 'line',
    })
  }

  const serviceFee = roundUsd(Number(totals?.platform_service_fee_usd ?? 0) * multiplier)
  if (serviceFee > 0) {
    lines.push({
      key: 'platform-service',
      label: 'AXIOM aggregation service',
      amount: serviceFee,
      kind: 'line',
    })
  }

  return lines
}

function usesTransparentPricing(totals) {
  return totals?.platform_service_fee_usd != null
}

/**
 * Itemized receipt: public feeds at $0 vendor, single aggregation service fee.
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
    const lines = []

    lines.push({
      key: 'package',
      label: `${presetLabel} · ${n} location${n === 1 ? '' : 's'}`,
      amount: null,
      kind: 'section',
    })

    lines.push({
      key: 'batch-subtotal',
      label: `Subtotal · ${n} location${n === 1 ? '' : 's'}`,
      amount: batchQuote.totals.subtotal_user_usd,
      kind: 'line',
    })

    if (batchQuote.totals.volume_savings_usd > 0) {
      lines.push({
        key: 'volume-savings',
        label: `Volume savings (${Math.round((batchQuote.totals.volume_discount_rate ?? 0) * 100)}%)`,
        amount: -batchQuote.totals.volume_savings_usd,
        kind: 'discount',
      })
    }

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
        'Public feeds have no vendor API cost. Licensed API lines show pass-through premium with margin. The aggregation service fee covers orchestration, compute, and hosting.',
    }
  }

  const lineItems = quote?.line_items ?? []
  const totals = quote?.totals ?? {}
  const lines = []

  lines.push({
    key: 'package',
    label: presetLabel,
    amount: null,
    kind: 'section',
  })

  if (usesTransparentPricing(totals)) {
    lines.push(...buildTransparentPricingLines(lineItems, totals))
  }

  return {
    title: quote?.isFinal ? 'Final receipt' : 'Estimate',
    lines,
    totalUsd: totals.user_price_usd,
    totalLabel: quote?.isFinal ? 'Total charged' : 'Estimated total',
    locationLines: null,
    footnote:
      'Public feeds have no vendor API cost. Licensed API lines show pass-through premium with margin. The aggregation service fee covers orchestration, compute, and hosting.',
  }
}

export { formatUsd }
