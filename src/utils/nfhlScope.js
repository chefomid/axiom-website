/**
 * FEMA NFHL flood-zone polygons cannot be queried for Global or National
 * extents. A continental-US envelope times out on hazards.fema.gov.
 * Vectors are local-only, once the map has a search point.
 */
export function canQueryNfhlVectors(scopeConfig = {}) {
  if (scopeConfig.scope !== 'local') return false
  const loc = scopeConfig.userLocation
  return Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng)
}
