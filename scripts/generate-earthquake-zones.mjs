/**
 * Densify PB2002 plate boundaries into earthquake-zone dot points.
 * Run: node scripts/generate-earthquake-zones.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const INPUT = join(root, 'public/data/pb2002-boundaries.json')
const OUTPUT = join(root, 'public/data/earthquake-zones.geojson')

/** Spacing in degrees — smaller = denser dots (reference map ~0.25°) */
const STEP_DEG = 0.26

function distanceDeg(a, b) {
  const dLon = b[0] - a[0]
  const dLat = b[1] - a[1]
  return Math.hypot(dLon, dLat)
}

function interpolate(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function densifyLineString(coords, step) {
  if (!coords?.length) return []
  const points = [coords[0]]
  let carry = 0

  for (let i = 1; i < coords.length; i += 1) {
    const start = coords[i - 1]
    const end = coords[i]
    const segLen = distanceDeg(start, end)
    if (segLen <= 0) continue

    let dist = step - carry
    while (dist <= segLen) {
      const t = dist / segLen
      points.push(interpolate(start, end, t))
      dist += step
    }
    carry = segLen - (dist - step)
    if (carry < 0) carry = 0
  }

  return points
}

function linesToDotFeatures(geojson) {
  const features = []
  let id = 0

  for (const feature of geojson.features ?? []) {
    const geom = feature.geometry
    if (!geom) continue

    const lineGroups =
      geom.type === 'LineString'
        ? [geom.coordinates]
        : geom.type === 'MultiLineString'
          ? geom.coordinates
          : []

    for (const line of lineGroups) {
      const dots = densifyLineString(line, STEP_DEG)
      for (const coord of dots) {
        features.push({
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

  return features
}

const source = JSON.parse(readFileSync(INPUT, 'utf8'))
const features = linesToDotFeatures(source)

const output = {
  type: 'FeatureCollection',
  name: 'World earthquake zones (PB2002 plate boundaries)',
  meta: { source: 'Peter Bird PB2002 via fraxen/tectonicplates', stepDeg: STEP_DEG },
  features,
}

writeFileSync(OUTPUT, JSON.stringify(output))
console.log(`Wrote ${features.length} zone dots → ${OUTPUT}`)
