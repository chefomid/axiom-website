/** Format dossier field values for display (comma-separated large numbers). */
const SKIP_COMMA_RE = /(^|_)(year|stories|story|parcel|apn|zip|postal|fips|lat|lng|lon|heading|pitch|fov)(_|$)/i

/**
 * @param {unknown} value
 * @param {string} [fieldKey]
 */
export function formatDisplayValue(value, fieldKey = '') {
  if (value == null || value === '') return value == null ? '' : value
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatNumeric(value, fieldKey)
  }
  const raw = String(value).trim()
  const plainNumber = /^-?\d+(\.\d+)?$/
  const commaNumber = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/
  if (!plainNumber.test(raw) && !commaNumber.test(raw)) return String(value)
  const n = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(n)) return String(value)
  return formatNumeric(n, fieldKey)
}

function formatNumeric(n, fieldKey) {
  const key = String(fieldKey ?? '')
  if (SKIP_COMMA_RE.test(key)) {
    return Number.isInteger(n) ? String(Math.trunc(n)) : String(n)
  }
  if (Math.abs(n) < 1000) {
    return Number.isInteger(n) ? String(Math.trunc(n)) : String(n)
  }
  return n.toLocaleString('en-US', {
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  })
}
