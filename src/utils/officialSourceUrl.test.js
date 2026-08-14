import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOfficialSourceUrl } from './officialSourceUrl.js'

describe('resolveOfficialSourceUrl wildfire', () => {
  it('opens Utah Fire Info for a named Utah fire instead of a guessed InciWeb slug', () => {
    const url = resolveOfficialSourceUrl({
      id: 'nifc-2026-UTNWS-200580',
      layer: 'wildfire',
      source: 'NIFC',
      lat: 40.930294,
      lng: -111.592255,
      title: 'Rocky Canyon',
      officialUrl: 'https://inciweb.wildfire.gov/incident-information/utnws-rocky-canyon',
      raw: {
        UniqueFireIdentifier: '2026-UTNWS-200580',
        IncidentName: 'Rocky Canyon',
        POOState: 'US-UT',
      },
    })
    assert.equal(url, 'https://utah-fire-info-utahdnr.hub.arcgis.com/')
  })

  it('opens Utah Fire Info for an EONET Utah fire that only has an IRWIN source', () => {
    const url = resolveOfficialSourceUrl({
      id: 'eonet-EONET_22446',
      layer: 'wildfire',
      lat: 40.939517,
      lng: -111.642133,
      title: 'Wildfire Rocky Canyon, Morgan, Utah',
      officialUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_22446',
      raw: {
        sources: [{ id: 'IRWIN', url: 'https://irwin.doi.gov/observer/incidents/2026-UTNWS-200580' }],
      },
    })
    assert.equal(url, 'https://utah-fire-info-utahdnr.hub.arcgis.com/')
  })

  it('still uses a public InciWeb page when EONET actually provides one', () => {
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

  it('opens CAL FIRE incidents for a named California fire', () => {
    const url = resolveOfficialSourceUrl({
      id: 'nifc-2026-CAENF-000111',
      layer: 'wildfire',
      source: 'NIFC',
      lat: 39.1,
      lng: -120.2,
      title: 'Example Fire',
      raw: { UniqueFireIdentifier: '2026-CAENF-000111', IncidentName: 'Example Fire', POOState: 'US-CA' },
    })
    assert.equal(url, 'https://www.fire.ca.gov/incidents')
  })

  it('centers the NIFC incident map on a named fire when no state briefing page is known', () => {
    const url = resolveOfficialSourceUrl({
      id: 'nifc-2026-FLFNF-000456',
      layer: 'wildfire',
      source: 'NIFC',
      lat: 30.258,
      lng: -84.988,
      title: 'Foster Bridge',
      officialUrl: 'https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@-84.988,30.258,11z',
      raw: { UniqueFireIdentifier: '2026-FLFNF-000456', IncidentName: 'Foster Bridge', POOState: 'US-FL' },
    })
    assert.match(url, /^https:\/\/www\.arcgis\.com\/apps\/mapviewer\/index\.html/)
    assert.match(url, /4181a117dc9e43db8598533e29972015/)
    assert.match(url, /-84\.988/)
    assert.match(url, /30\.258/)
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
