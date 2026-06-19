import { normalizeSuggestion } from '../utils/coords'
import { getOrCreateAnonId } from '../utils/anonId'
import { saveBillingResume } from '../utils/billingResume'
import { attachApiErrorMetadata, parseApiDetail } from '../utils/apiErrors'
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
    const parsed = parseApiDetail(detail)
    let message
    if (res.status === 402 && parsed && typeof parsed === 'object') {
      message = parsed.message ?? 'Insufficient credits'
    } else if (parsed?.message) {
      message = parsed.message
    } else if (typeof detail === 'string') {
      message = detail
    } else {
      message = JSON.stringify(detail)
    }
    const err = new Error(message)
    attachApiErrorMetadata(err, { status: res.status, detail })
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

let catalogCache = null
let catalogFetchPromise = null

/** Returns cached catalog synchronously, or null if not yet loaded. */
export function getCachedPropertyCatalog() {
  return catalogCache
}

/** Warm the catalog cache as early as possible (e.g. on route entry). */
export function prefetchPropertyCatalog() {
  if (catalogCache) return Promise.resolve(catalogCache)
  if (!catalogFetchPromise) {
    catalogFetchPromise = propertyFetch('/catalog')
      .then(parsePropertyResponse)
      .then(data => {
        catalogCache = data
        return data
      })
      .catch(err => {
        catalogFetchPromise = null
        throw err
      })
  }
  return catalogFetchPromise
}

export async function fetchPropertyCatalog() {
  return prefetchPropertyCatalog()
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

export async function quoteBatch({ addresses, selectedSources }) {
  const res = await propertyFetch('/quote/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      addresses: (addresses ?? []).map(a => a.trim()).filter(Boolean),
      selected_sources: selectedSources ?? [],
    }),
  })
  return parsePropertyResponse(res)
}

export async function enrichBatch({
  addresses,
  selectedSources,
  confirmedPriceUsd,
  anonId,
  batchId,
}) {
  const body = {
    addresses: (addresses ?? []).map(a => a.trim()).filter(Boolean),
    selected_sources: selectedSources ?? [],
    confirmed_price_usd: confirmedPriceUsd,
    anon_id: anonId ?? getOrCreateAnonId(),
  }
  if (batchId?.trim()) body.batch_id = batchId.trim()
  const res = await propertyFetch('/enrich/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  reportId,
}) {
  const body = {
    address: address.trim(),
    selected_sources: selectedSources ?? [],
    anon_id: anonId ?? getOrCreateAnonId(),
  }
  if (sourceUrl?.trim()) body.source_url = sourceUrl.trim()
  if (sourceUrls && Object.keys(sourceUrls).length > 0) body.source_urls = sourceUrls
  if (confirmedPriceUsd != null) body.confirmed_price_usd = confirmedPriceUsd
  if (reportId?.trim()) body.report_id = reportId.trim()

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

export async function fetchCheckoutStatus(sessionId, anonId) {
  const params = new URLSearchParams({
    session_id: sessionId,
    anon_id: anonId ?? getOrCreateAnonId(),
  })
  const res = await propertyFetch(`/billing/checkout-status?${params}`)
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    const detail = data.detail ?? data.message ?? res.statusText
    const err = new Error(
      typeof detail === 'string' ? detail : 'checkout-status rate limit exceeded (HTTP 429)',
    )
    attachApiErrorMetadata(err, { status: 429, detail })
    console.warn(
      '[checkout-status] HTTP 429 — polling hit API rate limit; will retry. Webhook fulfillment is recommended.',
    )
    throw err
  }
  return parsePropertyResponse(res)
}

export async function fetchCheckoutPaymentSummary(sessionId, anonId) {
  const params = new URLSearchParams({
    session_id: sessionId,
    anon_id: anonId ?? getOrCreateAnonId(),
  })
  const res = await propertyFetch(`/billing/checkout-payment-summary?${params}`)
  return parsePropertyResponse(res)
}

export async function requestCheckoutRefund(sessionId, anonId) {
  const res = await propertyFetch('/billing/refund-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      anon_id: anonId ?? getOrCreateAnonId(),
    }),
  })
  return parsePropertyResponse(res)
}

export async function fetchCheckoutResume(sessionId, anonId) {
  const params = new URLSearchParams({
    session_id: sessionId,
    anon_id: anonId ?? getOrCreateAnonId(),
  })
  const res = await propertyFetch(`/billing/checkout-resume?${params}`)
  return parsePropertyResponse(res)
}

export async function startBillingCheckout(packId, anonId, { embedded = false } = {}) {
  const res = await propertyFetch('/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      anon_id: anonId ?? getOrCreateAnonId(),
      pack_id: packId,
      embedded,
    }),
  })
  return parsePropertyResponse(res)
}

export async function fetchBatchCheckoutPreview({ addresses, selectedSources, anonId }) {
  const res = await propertyFetch('/billing/batch-checkout-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      anon_id: anonId ?? getOrCreateAnonId(),
      addresses: (addresses ?? []).map(a => a.trim()).filter(Boolean),
      selected_sources: selectedSources ?? [],
    }),
  })
  return parsePropertyResponse(res)
}

export async function fetchCheckoutPreview({ purpose, address, selectedSources, anonId, addresses }) {
  const params = new URLSearchParams({
    anon_id: anonId ?? getOrCreateAnonId(),
    purpose,
    address: address.trim(),
    selected_sources: (selectedSources ?? []).join(','),
  })
  const res = await propertyFetch(`/billing/checkout-preview?${params}`)
  return parsePropertyResponse(res)
}

export async function startQuoteCheckout({
  purpose,
  address,
  addresses,
  selectedSources,
  confirmedPriceUsd,
  anonId,
  resumeContext,
  embedded = false,
}) {
  if (resumeContext) {
    saveBillingResume({ resume: purpose, ...resumeContext })
  }
  const body = {
    anon_id: anonId ?? getOrCreateAnonId(),
    purpose,
    address: (address ?? '').trim(),
    selected_sources: selectedSources ?? [],
    embedded,
  }
  if (addresses?.length) body.addresses = addresses.map(a => a.trim()).filter(Boolean)
  if (confirmedPriceUsd != null) body.confirmed_price_usd = confirmedPriceUsd
  if (resumeContext?.sourceUrls && Object.keys(resumeContext.sourceUrls).length > 0) {
    body.source_urls = resumeContext.sourceUrls
  }

  const res = await propertyFetch('/billing/checkout-quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await parsePropertyResponse(res)
  if (data.confirmation_id && resumeContext) {
    saveBillingResume({
      resume: purpose,
      ...resumeContext,
      confirmationId: data.confirmation_id,
    })
  }
  return data
}

export async function fetchReportByConfirmation(confirmationId) {
  const id = confirmationId.trim().toUpperCase()
  const res = await propertyFetch(`/reports/confirmation/${encodeURIComponent(id)}`)
  if (res.status === 202) {
    const data = await res.json().catch(() => ({}))
    return { status: 'pending', ...data }
  }
  return parsePropertyResponse(res)
}

export async function emailReportConfirmation({ confirmationId, email, reportName }) {
  const body = {
    confirmation_id: confirmationId.trim().toUpperCase(),
    email: email.trim(),
  }
  const name = reportName?.trim()
  if (name) body.report_name = name
  const res = await propertyFetch('/reports/email-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parsePropertyResponse(res)
}

export function isPaymentRequiredError(err) {
  return err?.status === 402 || Boolean(err?.paymentRequired)
}

/** Never surface preset key-skip copy to users (dev hints caused production session leaks). */
export function buildPresetApplyNotice() {
  return null
}

export function formatUsd(amount) {
  if (amount == null || Number.isNaN(amount)) return '-'
  if (amount === 0) return '$0.00'
  return `$${Number(amount).toFixed(2)}`
}

/** Per-location price after batch volume discount and margin floor are allocated. */
export function batchLocationPrice(location) {
  if (location?.allocated_price_usd != null) return location.allocated_price_usd
  return location?.quote?.totals?.user_price_usd
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

/** Estimate user-facing price for a catalog source (pass-through premium with margin). */
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
  if (Number(item.api_cost_usd ?? 0) <= 0) return formatUsd(0)
  const loaded = Number(item.api_cost_usd ?? 0) + Number(item.service_cost_usd ?? 0)
  if (loaded <= 0) return formatUsd(0)
  return formatUsd(loaded)
}

/** Vendor API pass-through column in source catalog (public feeds are $0). */
export function formatVendorApiCost(source) {
  if (!source) return '-'
  const api = Number(source.api_cost_usd ?? 0)
  if (api <= 0) return formatUsd(0)
  return formatUsd(api)
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

/** Source IDs for a preset; drops licensed sources when their API key is not configured. */
export function presetSourceIds(catalog, preset) {
  if (!preset?.source_ids) return []
  return filterPresetSources(catalog, preset.source_ids)
}

/** Mirror backend resolve_selected_sources using catalog depends_on edges. */
export function resolveSelectedSources(catalog, selectedSources) {
  if (!catalog?.sources?.length) return selectedSources ?? []
  const byId = Object.fromEntries(catalog.sources.map(src => [src.id, src]))
  const resolved = []
  const seen = new Set()

  const add = sourceId => {
    if (seen.has(sourceId)) return
    const src = byId[sourceId]
    if (!src) return
    for (const dep of src.depends_on ?? []) add(dep)
    seen.add(sourceId)
    resolved.push(sourceId)
  }

  add('geocode_census')
  for (const sourceId of selectedSources ?? []) {
    if (sourceId !== 'geocode_census') add(sourceId)
  }
  return resolved
}

function roundUsd(value) {
  return Math.round(Number(value) * 100) / 100
}

/** Instant estimate from catalog — mirrors backend compute_totals without geocoding. */
export function estimateQuoteFromCatalog(catalog, selectedSources, addressInput = '') {
  if (!catalog?.sources?.length || !selectedSources?.length) return null

  const byId = Object.fromEntries(catalog.sources.map(src => [src.id, src]))
  const resolved = resolveSelectedSources(catalog, selectedSources)
  const multiplier = Number(catalog.margin_multiplier ?? 2.5)
  const infra = Number(catalog.infra_breakeven_usd ?? 0.45)
  const platformMargin = Number(catalog.platform_margin_usd ?? 1.0)

  const lineItems = []
  for (const sourceId of resolved) {
    const src = byId[sourceId]
    if (!src) continue
    const apiCost = Number(src.api_cost_usd ?? 0)
    const serviceCost = Number(src.service_cost_usd ?? 0)
    const keyOk = !src.requires_api_key || src.configured !== false
    const billable = keyOk
    const lineUserPrice = billable && apiCost > 0 ? roundUsd(apiCost * multiplier) : 0
    lineItems.push({
      source_id: sourceId,
      label: src.label,
      description: src.description,
      category: src.category,
      tier: src.tier,
      api_cost_usd: apiCost,
      service_cost_usd: serviceCost,
      loaded_cost_usd: roundUsd(apiCost + serviceCost),
      user_price_usd: lineUserPrice,
      billable,
      configured: keyOk,
      available: true,
    })
  }

  const billableItems = lineItems.filter(item => item.billable)
  const apiCost = billableItems.reduce((sum, item) => sum + item.api_cost_usd, 0)
  const serviceCost = billableItems.reduce((sum, item) => sum + item.service_cost_usd, 0)
  const breakeven = roundUsd(infra + serviceCost)
  const platformServiceFee = roundUsd(breakeven + platformMargin)
  let vendorCharges = roundUsd(apiCost * multiplier)
  const userPrice = roundUsd(platformServiceFee + vendorCharges)

  return {
    address_input: addressInput,
    selected_sources: resolved,
    line_items: lineItems,
    totals: {
      api_cost_usd: roundUsd(apiCost),
      service_cost_usd: roundUsd(serviceCost),
      loaded_cost_usd: roundUsd(apiCost + serviceCost),
      infra_breakeven_usd: infra,
      breakeven_usd: breakeven,
      platform_margin_usd: platformMargin,
      platform_service_fee_usd: platformServiceFee,
      vendor_charges_usd: vendorCharges,
      margin_multiplier: multiplier,
      user_price_usd: userPrice,
    },
    estimate: true,
  }
}

export function sourcesMatchQuote(selectedSources, quoteSources, catalog) {
  const normalize = ids =>
    [...new Set(ids ?? [])]
      .filter(id => id && id !== 'geocode_census')
      .sort()
  const resolvedSelected = normalize(resolveSelectedSources(catalog, selectedSources))
  const resolvedQuote = normalize(quoteSources)
  return JSON.stringify(resolvedSelected) === JSON.stringify(resolvedQuote)
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
