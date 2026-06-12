import { normalizeSuggestion } from '../utils/coords'
import { getOrCreateAnonId } from '../utils/anonId'
import { searchUsPropertyAddresses } from './geocode'

const USER_AGENT = 'AXIOM-PropertyIntelligence/0.1 (property-intelligence)'

export function propertyApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) return `/api/property${normalized}`
  const base = import.meta.env.VITE_PROPERTY_API_URL
  if (base) return `${base.replace(/\/$/, '')}${normalized}`
  return `/api/property${normalized}`
}

async function parsePropertyResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data.detail ?? data.message ?? res.statusText
    let message
    let paymentRequired = null
    if (res.status === 402 && detail && typeof detail === 'object') {
      paymentRequired = detail
      message = detail.message ?? 'Insufficient credits'
    } else if (Array.isArray(detail)) {
      message = detail.map(d => d.msg ?? JSON.stringify(d)).join('; ')
    } else if (typeof detail === 'string') {
      message = detail
    } else {
      message = JSON.stringify(detail)
    }
    const err = new Error(message)
    err.status = res.status
    err.paymentRequired = paymentRequired
    throw err
  }
  return data
}

function propertyFetch(path, options = {}) {
  return fetch(propertyApiUrl(path), {
    ...options,
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...options.headers,
    },
  })
}

export async function suggestPropertyAddresses(query, { limit = 5, signal, bbox } = {}) {
  const q = query.trim()
  if (q.length < 4) return []

  try {
    const local = await searchUsPropertyAddresses(q, { limit, signal, bbox, countryId: 'US' })
    const normalized = local.map(normalizeSuggestion).filter(Boolean)
    if (normalized.length) return normalized
  } catch (err) {
    if (err.name === 'AbortError') throw err
  }

  const params = new URLSearchParams({ q, limit: String(limit), country: 'US' })
  try {
    const res = await propertyFetch(`/suggest?${params}`, { signal })
    if (res.ok) {
      const data = await parsePropertyResponse(res)
      return (data.results ?? []).map(normalizeSuggestion).filter(Boolean)
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err
  }

  return []
}

export async function fetchPropertyCatalog() {
  const res = await propertyFetch('/catalog')
  return parsePropertyResponse(res)
}

export async function quoteProperty({ address, selectedSources }) {
  const res = await propertyFetch('/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: address.trim(),
      selected_sources: selectedSources ?? [],
    }),
  })
  return parsePropertyResponse(res)
}

export async function discoverSourceUrls({ address, selectedSources, anonId }) {
  const res = await propertyFetch('/discover-source-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: address.trim(),
      selected_sources: selectedSources ?? [],
      anon_id: anonId ?? getOrCreateAnonId(),
    }),
  })
  return parsePropertyResponse(res)
}

export async function enrichProperty({
  address,
  selectedSources,
  sourceUrl,
  sourceUrls,
  confirmedPriceUsd,
  anonId,
}) {
  const body = {
    address: address.trim(),
    selected_sources: selectedSources ?? [],
    anon_id: anonId ?? getOrCreateAnonId(),
  }
  if (sourceUrl?.trim()) body.source_url = sourceUrl.trim()
  if (sourceUrls && Object.keys(sourceUrls).length > 0) body.source_urls = sourceUrls
  if (confirmedPriceUsd != null) body.confirmed_price_usd = confirmedPriceUsd

  const res = await propertyFetch('/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parsePropertyResponse(res)
}

export async function checkPropertyApiHealth() {
  const res = await propertyFetch('/health')
  return res.ok
}

export async function fetchPropertyEnvStatus() {
  const res = await propertyFetch('/env-status')
  return parsePropertyResponse(res)
}

export async function fetchBillingPacks() {
  const res = await propertyFetch('/billing/packs')
  return parsePropertyResponse(res)
}

export async function fetchBillingBalance(anonId) {
  const params = new URLSearchParams({ anon_id: anonId ?? getOrCreateAnonId() })
  const res = await propertyFetch(`/billing/balance?${params}`)
  return parsePropertyResponse(res)
}

export async function startBillingCheckout(packId, anonId) {
  const res = await propertyFetch('/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      anon_id: anonId ?? getOrCreateAnonId(),
      pack_id: packId,
    }),
  })
  return parsePropertyResponse(res)
}

export function isPaymentRequiredError(err) {
  return err?.status === 402 || Boolean(err?.paymentRequired)
}

/** Human-readable notice when a preset drops sources (missing keys, etc.). */
export function buildPresetApplyNotice(catalog, preset, appliedIds) {
  const requested = preset?.source_ids ?? []
  const applied = appliedIds ?? []
  const skipped = requested.filter(id => !applied.includes(id))
  if (!skipped.length) return null

  const byId = Object.fromEntries((catalog?.sources ?? []).map(s => [s.id, s]))
  const parts = skipped.map(id => {
    const src = byId[id]
    if (!src) return id
    if (src.requires_api_key && src.configured === false) {
      const key = src.env_key ?? 'API key'
      return `${src.label} (add ${key})`
    }
    if (id === 'sov_orchestrator' && src?.requires_api_key && src.configured === false) {
      return `${src.label} (optional, add OPENAI_API_KEY for multi-lane reconciliation)`
    }
    return src.label
  })
  return `Skipped: ${parts.join('; ')}. Loaded the rest of this preset.`
}

export function formatUsd(amount) {
  if (amount == null || Number.isNaN(amount)) return '-'
  if (amount === 0) return '$0.00'
  return `$${Number(amount).toFixed(2)}`
}

export function sourcesNeedingUrl(catalog, selectedSources) {
  if (!catalog?.sources || !selectedSources?.length) return false
  const byId = Object.fromEntries(catalog.sources.map(s => [s.id, s]))
  return selectedSources.some(id => byId[id]?.needs_source_url)
}

export function sourcesNeedingUrlIds(catalog, selectedSources) {
  if (!catalog?.sources || !selectedSources?.length) return []
  const byId = Object.fromEntries(catalog.sources.map(s => [s.id, s]))
  return selectedSources.filter(id => byId[id]?.needs_source_url)
}

export function filterPresetSources(catalog, sourceIds) {
  if (!catalog?.sources || !sourceIds?.length) return sourceIds ?? []
  const byId = Object.fromEntries(catalog.sources.map(s => [s.id, s]))
  const filtered = sourceIds.filter(id => {
    const src = byId[id]
    if (!src) return false
    if (src.requires_api_key && src.configured === false) return false
    return true
  })
  return filtered
}

export function insuranceSourcesConfigured(catalog) {
  if (!catalog?.sources) return false
  return catalog.sources.some(
    s => s.tier === 'insurance' && s.requires_api_key && s.configured !== false,
  )
}

export function openAiConfigured(catalog) {
  const src = catalog?.sources?.find(s => s.id === 'web_property_research')
  if (src) return src.configured !== false
  return catalog?.sources?.some(s => s.env_key === 'OPENAI_API_KEY' && s.configured !== false)
}

/** Optional add-ons that can be layered on a preset without breaking preset match. */
export const PRESET_OPTIONAL_ADDONS = ['web_property_research', 'vision_construction']

export function quoteLineItem(catalog, quote, sourceId) {
  return quote?.line_items?.find(item => item.source_id === sourceId) ?? null
}

/** Estimate user-facing price for a catalog source (before minimum-charge bundle adjustment). */
export function estimateSourceUserPrice(source, catalog) {
  if (!source) return null
  if (source.requires_api_key && source.configured === false) return null
  const multiplier = catalog?.margin_multiplier ?? 2.5
  const loaded = Number(source.api_cost_usd ?? 0) + Number(source.service_cost_usd ?? 0)
  if (loaded <= 0) return 0
  return Math.round(loaded * multiplier * 100) / 100
}

export function formatLineItemPrice(item) {
  if (!item) return '-'
  if (item.user_price_usd != null && item.user_price_usd > 0) return formatUsd(item.user_price_usd)
  const loaded = Number(item.api_cost_usd ?? 0) + Number(item.service_cost_usd ?? 0)
  if (loaded <= 0) return 'free'
  return formatUsd(loaded)
}

export function groupSourcesByCategory(catalog) {
  if (!catalog?.categories || !catalog?.sources) return []
  const byCategory = Object.fromEntries(catalog.categories.map(c => [c.id, { ...c, sources: [] }]))
  for (const src of catalog.sources) {
    if (!src.selectable) continue
    const bucket = byCategory[src.category]
    if (bucket) bucket.sources.push(src)
  }
  return catalog.categories
    .map(c => byCategory[c.id])
    .filter(g => g.sources.length > 0)
}

/** Source IDs for a preset after insurance-key filtering. */
export function presetSourceIds(catalog, preset) {
  if (!preset?.source_ids) return []
  if (preset.highlight === 'insurance' || preset.id === 'cope_insurance') {
    return filterPresetSources(catalog, preset.source_ids)
  }
  return preset.source_ids
}

export function sourcesMatchQuote(selectedSources, quoteSources) {
  const normalize = ids =>
    [...new Set(ids ?? [])]
      .filter(id => id && id !== 'geocode_census')
      .sort()
  return JSON.stringify(normalize(selectedSources)) === JSON.stringify(normalize(quoteSources))
}

export function sourcesMatchPreset(catalog, presetId, selectedSources) {
  const preset = catalog?.presets?.find(p => p.id === presetId)
  if (!preset) return false
  const expected = [...presetSourceIds(catalog, preset)].sort()
  const actual = [...(selectedSources ?? [])]
    .filter(id => !PRESET_OPTIONAL_ADDONS.includes(id))
    .sort()
  if (expected.length !== actual.length) return false
  return expected.every((id, i) => id === actual[i])
}
