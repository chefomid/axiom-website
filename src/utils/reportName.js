const ZIP_SUFFIX_RE = /,?\s*\d{5}(?:-\d{4})?\s*$/

/** Street, city, and state — no ZIP. */
export function formatReportNameFromAddress(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw.trim().replace(ZIP_SUFFIX_RE, '').replace(/,\s*$/, '').trim()
}

export function defaultReportNameFromRecord(record) {
  if (!record) return ''
  const raw = record.address_input || record.display_name || ''
  return formatReportNameFromAddress(raw)
}

export function defaultReportNameFromBatch(batchRun) {
  if (!batchRun) return ''
  const enriched = (batchRun.locations ?? []).find(loc => loc.record)
  if (enriched?.record) {
    return defaultReportNameFromRecord(enriched.record)
  }
  const withAddress = (batchRun.locations ?? []).find(loc => loc.address_input)
  if (withAddress?.address_input) {
    return formatReportNameFromAddress(withAddress.address_input)
  }
  return ''
}

export function defaultReportNameFromContext(ctx) {
  if (!ctx) return ''
  if (ctx.address) return formatReportNameFromAddress(ctx.address)
  if (ctx.addresses?.length) return formatReportNameFromAddress(ctx.addresses[0])
  return ''
}
