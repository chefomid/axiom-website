import {
  isLicensedReceiptLine,
  licensedReceiptLineItems,
  licensedReceiptLineAmount,
} from '../../utils/receiptLicensedLines'

export function emptyHint({ address, selectedCount, locationLocked, loading, quoteError, apiOnline }) {
  if (apiOnline === false) return 'Property API offline'
  if (!address?.trim()) return 'Add an address'
  if (selectedCount === 0) return 'Choose a package'
  if (quoteError) return String(quoteError).split('\n')[0]
  if (loading) return 'Calculating…'
  if (!locationLocked) return 'Confirm address to lock map'
  return 'Waiting for estimate…'
}

/** Receipt line amounts: $0 (or credit) = green, positive = orange. */
export function receiptAmountClass(amount) {
  if (amount == null) return 'text-ink-secondary'
  const value = Number(amount)
  if (Number.isNaN(value)) return 'text-ink-secondary'
  if (value <= 0) return 'text-command-stable'
  return 'text-command-watch'
}

/** Platform orchestration fee only (excludes licensed vendor API pass-through). */
export function platformServiceFeeUsd(totals) {
  if (!totals) return 0
  return Number(totals.platform_service_fee_usd ?? 0)
}

/** @deprecated use licensedReceiptLineItems */
export function licensedQuoteLineItems(quote) {
  return licensedReceiptLineItems(quote)
}

export {
  isLicensedReceiptLine,
  licensedReceiptLineItems,
  licensedReceiptLineAmount,
}
