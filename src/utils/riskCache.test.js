import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getLastGoodRiskCache,
  getRiskCache,
  rememberLastGoodRiskCache,
  setRiskCache,
} from './riskCache.js'

describe('wildfire last-good cache', () => {
  const key = `test-firms-${Date.now()}`

  it('keeps the last successful fire payload when a later run returns zero events', () => {
    const good = { events: [{ id: 'fire-1', lat: 34, lng: -118 }], providers: ['nifc'] }
    setRiskCache('firms', key, good)
    rememberLastGoodRiskCache('firms', key, good)

    setRiskCache('firms', key, { events: [], providers: ['firms'] })
    rememberLastGoodRiskCache('firms', key, { events: [], providers: ['firms'] })

    const lastGood = getLastGoodRiskCache('firms', key)
    assert.equal(lastGood.data.events.length, 1)
    assert.equal(lastGood.data.events[0].id, 'fire-1')
  })

  it('replaces last-good only when a new run has events', () => {
    const key2 = `${key}-replace`
    rememberLastGoodRiskCache('firms', key2, { events: [{ id: 'old' }] })
    rememberLastGoodRiskCache('firms', key2, { events: [{ id: 'new' }, { id: 'new-2' }] })
    assert.equal(getLastGoodRiskCache('firms', key2).data.events[0].id, 'new')
  })
})
