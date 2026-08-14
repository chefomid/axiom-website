import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOfficialSourceUrl } from './officialSourceUrl.js'

describe('resolveOfficialSourceUrl wildfire', () => {
  it('opens the InciWeb incident page for a named NIFC fire', () => {
    const url = resolveOfficialSourceUrl({
      id: 'nifc-2026-FLFNF-000456',
      layer: 'wildfire',
      source: 'NIFC',
      lat: 30.258,
      lng: -84.988,
      title: 'Foster Bridge',
      officialUrl: 'https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@-84.988,30.258,11z',
      raw: { UniqueFireIdentifier: '2026-FLFNF-000456', IncidentName: 'Foster Bridge' },
    })
    assert.equal(url, 'https://inciweb.wildfire.gov/incident-information/flfnf-foster-bridge')
  })

  it('builds InciWeb from an EONET IRWIN identifier instead of sending users to FIRMS', () => {
    const url = resolveOfficialSourceUrl({
      id: 'eonet-EONET_22430',
      layer: 'wildfire',
      lat: 46.3,
      lng: -106.5,
      title: 'Wildfire Harris, Rosebud, Montana',
      officialUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_22430',
      raw: {
        sources: [{ id: 'IRWIN', url: 'https://irwin.doi.gov/observer/incidents/2026-MTMCD-000676' }],
      },
    })
    assert.equal(url, 'https://inciweb.wildfire.gov/incident-information/mtmcd-harris')
  })

  it('prefers a public InciWeb incident page when EONET provides one', () => {
    const url = resolveOfficialSourceUrl({
      id: 'eonet-EONET_1',
      layer: 'wildfire',
      lat: 39.1,
      lng: -120.2,
      officialUrl: 'https://irwin.doi.gov/observer/incidents/2026-CAENF-000111',
      raw: {
        sources: [
          { id: 'IRWIN', url: 'https://irwin.doi.gov/observer/incidents/2026-CAENF-000111' },
          { id: 'InciWeb', url: 'https://inciweb.wildfire.gov/incident-information/caenf-example-fire' },
        ],
      },
    })
    assert.equal(url, 'https://inciweb.wildfire.gov/incident-information/caenf-example-fire')
  })

  it('centers the FIRMS map on a satellite hotspot instead of the FIRMS homepage', () => {
    const url = resolveOfficialSourceUrl({
      id: 'firms-39.8--121.5-2026-08-12-1812',
      layer: 'wildfire',
      lat: 39.8,
      lng: -121.5,
      officialUrl: 'https://firms.modaps.eosdis.nasa.gov/map/',
      raw: { latitude: '39.8', longitude: '-121.5' },
    })
    assert.equal(url, 'https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@-121.5,39.8,11z')
  })
})
