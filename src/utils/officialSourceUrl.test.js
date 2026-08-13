import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOfficialSourceUrl } from './officialSourceUrl.js'

describe('resolveOfficialSourceUrl wildfire', () => {
  it('opens the IRWIN incident page for a NIFC named fire', () => {
    const url = resolveOfficialSourceUrl({
      layer: 'wildfire',
      lat: 30.258,
      lng: -84.988,
      officialUrl: 'https://data-nifc.opendata.arcgis.com/',
      raw: { UniqueFireIdentifier: '2026-FLFNF-000456', IncidentName: 'Foster Bridge' },
    })
    assert.equal(url, 'https://irwin.doi.gov/observer/incidents/2026-FLFNF-000456')
  })

  it('uses the EONET IRWIN source instead of the EONET API or homepage', () => {
    const url = resolveOfficialSourceUrl({
      layer: 'wildfire',
      lat: 46.3,
      lng: -106.5,
      officialUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_22430',
      raw: {
        sources: [{ id: 'IRWIN', url: 'https://irwin.doi.gov/observer/incidents/2026-MTMCD-000676' }],
      },
    })
    assert.equal(url, 'https://irwin.doi.gov/observer/incidents/2026-MTMCD-000676')
  })

  it('centers the FIRMS map on a satellite hotspot instead of the FIRMS homepage', () => {
    const url = resolveOfficialSourceUrl({
      layer: 'wildfire',
      lat: 39.8,
      lng: -121.5,
      officialUrl: 'https://firms.modaps.eosdis.nasa.gov/map/',
      raw: { latitude: '39.8', longitude: '-121.5' },
    })
    assert.equal(url, 'https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@-121.5,39.8,11z')
  })
})
