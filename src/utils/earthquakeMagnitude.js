/** Lowest magnitude requested from USGS, matches the "All" preset (catalog completeness floor). */
export const USGS_CATALOG_MIN_MAGNITUDE = 2.5

/**
 * Whether an event/marker passes the selected minimum magnitude (cumulative M3+ ⊃ M4+ …).
 * @param {number | null | undefined} mag
 * @param {number} minMagnitude, UI preset (2.5 = All, 3 = M3+, …)
 */
export function passesMinMagnitude(mag, minMagnitude) {
  const floor =
    minMagnitude <= USGS_CATALOG_MIN_MAGNITUDE ? USGS_CATALOG_MIN_MAGNITUDE : minMagnitude
  return Number.isFinite(mag) && mag >= floor
}

export function filterEventsByMinMagnitude(events, minMagnitude) {
  return (events ?? []).filter(e => passesMinMagnitude(e.mag, minMagnitude))
}

export function filterMarkersByMinMagnitude(markers, minMagnitude) {
  return (markers ?? []).filter(m => passesMinMagnitude(m.mag, minMagnitude))
}
