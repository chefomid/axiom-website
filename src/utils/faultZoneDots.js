/** Convert line GeoJSON features into evenly spaced dot points. */
export function densifyLineString(coords, stepDeg = 0.26) {
  if (!coords?.length) return []

  const points = [coords[0]]
  let carry = 0

  for (let i = 1; i < coords.length; i += 1) {
    const start = coords[i - 1]
    const end = coords[i]
    const segLen = Math.hypot(end[0] - start[0], end[1] - start[1])
    if (segLen <= 0) continue

    let dist = stepDeg - carry
    while (dist <= segLen) {
      const t = dist / segLen
      points.push([
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ])
      dist += stepDeg
    }
    carry = Math.max(0, segLen - (dist - stepDeg))
  }

  return points
}

export function lineFeaturesToDotFeatures(features, stepDeg = 0.26) {
  const dots = []
  let id = 0

  for (const feature of features ?? []) {
    const geom = feature.geometry
    if (!geom) continue

    const lines =
      geom.type === 'LineString'
        ? [geom.coordinates]
        : geom.type === 'MultiLineString'
          ? geom.coordinates
          : geom.type === 'Point'
            ? [[geom.coordinates]]
            : []

    for (const line of lines) {
      const coords = geom.type === 'Point' ? line : densifyLineString(line, stepDeg)
      for (const coord of coords) {
        dots.push({
          type: 'Feature',
          properties: {
            id: id++,
            name: feature.properties?.Name ?? feature.properties?.name ?? '',
          },
          geometry: { type: 'Point', coordinates: coord },
        })
      }
    }
  }

  return dots
}

/** Keep only points inside a lon/lat envelope. */
export function filterPointsByBbox(geojson, bbox) {
  const [west, south, east, north] = bbox
  const features = (geojson.features ?? []).filter(f => {
    const [lon, lat] = f.geometry?.coordinates ?? []
    return lon >= west && lon <= east && lat >= south && lat <= north
  })
  return { ...geojson, features }
}

export function mergeToPointCollection(features, meta = {}) {
  return {
    type: 'FeatureCollection',
    features,
    meta,
  }
}
