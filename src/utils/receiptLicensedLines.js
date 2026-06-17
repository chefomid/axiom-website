const SKIP_MESSAGE =
  /quota|insufficient|401|403|429|rate limit|not configured|api key|unauthorized|forbidden|privilege|token|billing|credit|limit exceeded|payment required/i

/** Licensed API row belongs on a receipt only when it will / did incur a premium charge. */
export function isLicensedReceiptLine(item) {
  if (!item || item.source_id === 'geocode_census') return false
  if (Number(item.api_cost_usd ?? 0) <= 0) return false
  if (item.billable === false || item.configured === false) return false

  const message = `${item.message ?? ''}`.toLowerCase()
  if (message && SKIP_MESSAGE.test(message)) return false

  if (item.run_status != null) {
    if (item.run_status !== 'success') return false
    if (item.charged === false) return false
    if (Number(item.user_price_usd ?? 0) <= 0) return false
  }

  return true
}

export function licensedReceiptLineItems(quote) {
  return (quote?.line_items ?? []).filter(isLicensedReceiptLine)
}

export function licensedReceiptLineAmount(item) {
  return Number(item.user_price_usd ?? 0)
}
