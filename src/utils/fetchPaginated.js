/**
 * Paginate USGS FDSNWS GeoJSON until a page returns fewer than `pageSize` features.
 */
export async function fetchAllUsgsFeatures(buildUrl, { pageSize = 2000, signal } = {}) {
  const all = []

  while (true) {
    const pagination = { limit: pageSize }
    if (all.length > 0) {
      pagination.offset = all.length + 1
    }
    const url = buildUrl(pagination)
    const response = await fetch(url, { signal })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`USGS API error (${response.status})${detail ? `: ${detail.slice(0, 120)}` : ''}`)
    }
    const data = await response.json()
    const page = data.features ?? []
    all.push(...page)
    if (page.length < pageSize) break
  }

  return all
}

/**
 * Paginate OpenFEMA OData ($top max 10000 per request).
 */
export async function fetchAllOpenFemaRecords(baseUrl, params, { pageSize = 10000, signal } = {}) {
  const all = []
  let skip = 0

  while (true) {
    const qs = new URLSearchParams({
      ...params,
      $top: String(pageSize),
      $skip: String(skip),
    })
    const response = await fetch(`${baseUrl}?${qs}`, { signal })
    if (!response.ok) {
      throw new Error(`OpenFEMA API error (${response.status})`)
    }
    const data = await response.json()
    const key = Object.keys(data).find(k => Array.isArray(data[k]) && k !== 'metadata')
    const page = key ? data[key] : []
    all.push(...page)
    if (page.length < pageSize) break
    skip += pageSize
  }

  return all
}
