import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canQueryNfhlVectors } from './nfhlScope.js'

describe('canQueryNfhlVectors', () => {
  it('skips vector queries for global view (CONUS bbox times out on FEMA)', () => {
    assert.equal(canQueryNfhlVectors({ scope: 'global', countryId: 'US' }), false)
  })

  it('skips vector queries for national US view', () => {
    assert.equal(canQueryNfhlVectors({ scope: 'national', countryId: 'US' }), false)
  })

  it('skips local view until a map location exists', () => {
    assert.equal(canQueryNfhlVectors({ scope: 'local', countryId: 'US', radiusMiles: 50 }), false)
  })

  it('allows a local 50-mile search around a US city', () => {
    assert.equal(
      canQueryNfhlVectors({
        scope: 'local',
        countryId: 'US',
        radiusMiles: 50,
        userLocation: { lat: 29.76, lng: -95.37 },
      }),
      true,
    )
  })
})
