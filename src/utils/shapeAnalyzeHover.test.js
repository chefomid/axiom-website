import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { insetPointToward } from './shapeAnalyzeHover.js'

describe('insetPointToward', () => {
  it('moves a hover point toward the shape interior so Analyze stays on the fill', () => {
    assert.deepEqual(insetPointToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 40), { x: 40, y: 0 })
  })

  it('stays put when the interior target is the same pixel', () => {
    assert.deepEqual(insetPointToward({ x: 10, y: 12 }, { x: 10, y: 12 }, 40), { x: 10, y: 12 })
  })
})
