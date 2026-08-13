/** NASA FIRMS area queries reject envelopes larger than ~10 degrees. */
export const FIRMS_MAX_SPAN_DEG = 10

export function bboxMaxSpanDeg(bbox) {
  if (!bbox) return Infinity
  return Math.max(Number(bbox.east) - Number(bbox.west), Number(bbox.north) - Number(bbox.south))
}

/**
 * FIRMS area token for the area CSV API.
 * Global/national and oversized local boxes use the USA region, not a CONUS envelope.
 */
export function firmsAreaForScope(scope, bbox) {
  if (scope !== 'local') return 'usa'
  if (!bbox || bboxMaxSpanDeg(bbox) > FIRMS_MAX_SPAN_DEG) return 'usa'
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
}

/**
 * Parse FIRMS CSV. Error pages and key/area failures must throw, not look like zero fires.
 */
export function parseFirmsCsv(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) throw new Error('NASA FIRMS returned an empty response')

  const lines = trimmed.split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  const headerKeys = headers.map(h => h.toLowerCase())
  if (!headerKeys.includes('latitude') || !headerKeys.includes('longitude')) {
    throw new Error(`NASA FIRMS error: ${trimmed.slice(0, 160)}`)
  }
  if (lines.length < 2) return []

  return lines.slice(1).map(line => {
    const values = line.split(',')
    const row = {}
    headers.forEach((h, i) => {
      row[h] = values[i]?.trim()
    })
    return row
  })
}
