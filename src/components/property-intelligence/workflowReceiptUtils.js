export function emptyHint({ address, selectedCount, locationLocked, loading, quoteError, apiOnline }) {
  if (apiOnline === false) return 'Property API offline'
  if (!address?.trim()) return 'Add an address'
  if (selectedCount === 0) return 'Choose a package'
  if (quoteError) return quoteError
  if (loading) return 'Calculating…'
  if (!locationLocked) return 'Confirm address to lock map'
  return 'Waiting for estimate…'
}
