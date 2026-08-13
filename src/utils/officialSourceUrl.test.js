import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOfficialSourceUrl } from './officialSourceUrl.js'

describe('resolveOfficialSourceUrl wildfire', () => {
  it('opens the FIRMS map on a named NIFC fire instead of IRWIN login', () => {
    const url = resolveOfficialSourceUrl({
      layer: 'wildfire',
      lat: 30.258,
      lng: -84.988,
      officialUrl: 'https://data-nifc.opendata.arcgis.com/',
      raw: { UniqueFireIdentifier: '2026-FLFNF-000456', IncidentName: 'Foster Bridge' },
    })
    assert.equal(url, 'https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@-84.988,30.258,11z')
  })

  it('does not send EONET fires to IRWIN login', () => {
    const url = resolveOfficialSourceUrl({
      layer: 'wildfire',
      lat: 46.3,
      lng: -106.5,
      officialUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_22430',
      raw: {
        sources: [{ id: 'IRWIN', url: 'https://irwin.doi.gov/observer/incidents/2026-MTMCD-000676' }],
      },
    })
    assert.equal(url, 'https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@-106.5,46.3,11z')
  })

  it('prefers a public InciWeb incident page when EONET provides one', () => {
    const url = resolveOfficialSourceUrl({
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
      layer: 'wildfire',
      lat: 39.8,
      lng: -121.5,
      officialUrl: 'https://firms.modaps.eosdis.nasa.gov/map/',
      raw: { latitude: '39.8', longitude: '-121.5' },
    })
    assert.equal(url, 'https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@-121.5,39.8,11z')
  })
})
