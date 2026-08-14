import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  containedPercent,
  filterMarkersByWildfireKind,
  mergeWildfireEvents,
  wildfireFlameScale,
  wildfireKindFromMarker,
} from './wildfireDisplay.js'

describe('mergeWildfireEvents', () => {
  it('keeps a FIRMS hotspot even when it sits on the same coordinate as a named fire', () => {
    const named = { id: 'nifc-1', lat: 39.8, lng: -121.5, layer: 'wildfire' }
    const hotspotAtSameSpot = {
      id: 'firms-39.8--121.5-2026-08-12-1812',
      lat: 39.8,
      lng: -121.5,
      layer: 'wildfire',
    }
    const merged = mergeWildfireEvents([named], [hotspotAtSameSpot])
    assert.deepEqual(
      merged.map(m => m.id).sort(),
      [hotspotAtSameSpot.id, named.id].sort(),
    )
  })
})

const hotspot = {
  id: 'firms-39.8--121.5-2026-08-12-1812',
  layer: 'wildfire',
  source: 'NASA',
  raw: { frp: '8.2', bright_ti4: '340', latitude: '39.8' },
}

const namedNifc = {
  id: 'nifc-2026-FLFNF-000456',
  layer: 'wildfire',
  source: 'NIFC',
  raw: { IncidentSize: 2400, IncidentName: 'Foster Bridge' },
}

const namedEonet = {
  id: 'eonet-EONET_22430',
  layer: 'wildfire',
  source: 'NASA',
  raw: { geometry: [{ magnitudeValue: 924.3, magnitudeUnit: 'acres' }] },
}

const quake = { id: 'usgs-1', layer: 'earthquake' }

describe('wildfireKindFromMarker', () => {
  it('treats FIRMS detections as hotspots and NIFC/EONET as named fires', () => {
    assert.equal(wildfireKindFromMarker(hotspot), 'hotspot')
    assert.equal(wildfireKindFromMarker(namedNifc), 'named')
    assert.equal(wildfireKindFromMarker(namedEonet), 'named')
  })
})

describe('filterMarkersByWildfireKind', () => {
  const markers = [hotspot, namedNifc, namedEonet, quake]

  it('keeps every marker when mode is both', () => {
    assert.deepEqual(
      filterMarkersByWildfireKind(markers, 'both').map(m => m.id),
      markers.map(m => m.id),
    )
  })

  it('keeps only FIRMS hotspots when mode is hotspot', () => {
    assert.deepEqual(
      filterMarkersByWildfireKind(markers, 'hotspot').map(m => m.id),
      [hotspot.id, quake.id],
    )
  })

  it('keeps only named NIFC and EONET fires when mode is named', () => {
    assert.deepEqual(
      filterMarkersByWildfireKind(markers, 'named').map(m => m.id),
      [namedNifc.id, namedEonet.id, quake.id],
    )
  })
})

describe('wildfireFlameScale', () => {
  it('sizes named fires by acres so large incidents read bigger than small ones', () => {
    const small = wildfireFlameScale({
      ...namedNifc,
      raw: { IncidentSize: 8 },
    })
    const large = wildfireFlameScale({
      ...namedNifc,
      raw: { IncidentSize: 18000 },
    })
    assert.ok(large > small)
    assert.ok(large >= 1.3)
    assert.ok(small <= 0.7)
  })

  it('keeps FIRMS hotspot flames smaller than a large named fire', () => {
    const hotspotScale = wildfireFlameScale({
      ...hotspot,
      raw: { frp: '90', bright_ti4: '420' },
    })
    const namedScale = wildfireFlameScale({
      ...namedNifc,
      raw: { IncidentSize: 18000 },
    })
    assert.ok(hotspotScale < namedScale)
    assert.ok(hotspotScale < 0.9)
  })

  it('uses brighter FRP to enlarge a hotspot relative to a weak one', () => {
    const weak = wildfireFlameScale({ ...hotspot, raw: { frp: '2' } })
    const strong = wildfireFlameScale({ ...hotspot, raw: { frp: '70' } })
    assert.ok(strong > weak)
  })
})

describe('containedPercent', () => {
  it('reads NIFC PercentContained and clamps to 0-100', () => {
    assert.equal(containedPercent({ raw: { PercentContained: 72 } }), 72)
    assert.equal(containedPercent({ raw: { PercentContained: 140 } }), 100)
    assert.equal(containedPercent({ raw: { PercentContained: -4 } }), 0)
  })

  it('falls back to detail text and skips fires without containment', () => {
    assert.equal(
      containedPercent({ detail: 'Wildfire · 102,004 acres · 72% contained' }),
      72,
    )
    assert.equal(containedPercent(hotspot), null)
  })
})
