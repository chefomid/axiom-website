import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { firmsAreaForScope, parseFirmsCsv } from './firmsFeed.js'

describe('firmsAreaForScope', () => {
  const conus = { west: -125, south: 24, east: -66, north: 50 }

  it('uses the USA region for global view instead of a CONUS envelope that exceeds the 10 degree FIRMS limit', () => {
    assert.equal(firmsAreaForScope('global', conus), 'usa')
  })

  it('uses the USA region for national view', () => {
    assert.equal(firmsAreaForScope('national', conus), 'usa')
  })

  it('uses a bbox for a small local search', () => {
    const houston = { west: -95.6, south: 29.6, east: -95.1, north: 30.0 }
    assert.equal(firmsAreaForScope('local', houston), '-95.6,29.6,-95.1,30')
  })
})

describe('parseFirmsCsv', () => {
  it('parses a valid FIRMS CSV row', () => {
    const csv = 'latitude,longitude,bright_ti4,acq_date,acq_time,confidence\n29.7,-95.3,330,2026-08-12,1812,h\n'
    const rows = parseFirmsCsv(csv)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].latitude, '29.7')
  })

  it('rejects MAP KEY and area errors instead of treating them as zero fires', () => {
    assert.throws(() => parseFirmsCsv('Invalid MAP KEY.'), /FIRMS/)
    assert.throws(() => parseFirmsCsv('Invalid AREA'), /FIRMS/)
  })
})
