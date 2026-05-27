/**
 * Official report / source page for a map marker, when one exists.
 * @param {object | null | undefined} marker
 * @returns {string | null}
 */
export function getMarkerReportUrl(marker) {
  if (!marker) return null
  const url = marker.usgsUrl ?? marker.nwsUrl ?? marker.femaUrl ?? marker.officialUrl
  return typeof url === 'string' && url.startsWith('http') ? url : null
}
