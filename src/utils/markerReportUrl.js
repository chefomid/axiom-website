import { resolveOfficialSourceUrl } from './officialSourceUrl'

/**
 * Official report / source page for a map marker, when one exists.
 * @param {object | null | undefined} marker
 * @returns {string | null}
 */
export function getMarkerReportUrl(marker) {
  return resolveOfficialSourceUrl(marker)
}
