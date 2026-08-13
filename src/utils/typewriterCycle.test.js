import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { typewriterDelayMs, typewriterStep } from './typewriterCycle.js'

describe('typewriterStep', () => {
  it('types the current message one character at a time', () => {
    const first = typewriterStep({ text: '', messageIndex: 0, phase: 'typing', messages: ['Hi', 'Bye'] })
    assert.deepEqual(first, { text: 'H', messageIndex: 0, phase: 'typing' })

    const second = typewriterStep({ text: 'H', messageIndex: 0, phase: 'typing', messages: ['Hi', 'Bye'] })
    assert.deepEqual(second, { text: 'Hi', messageIndex: 0, phase: 'typing' })
  })

  it('holds after a message is complete, then deletes and advances', () => {
    const hold = typewriterStep({ text: 'Hi', messageIndex: 0, phase: 'typing', messages: ['Hi', 'Bye'] })
    assert.equal(hold.phase, 'holding')

    const startDelete = typewriterStep({ ...hold, phase: 'holding' })
    assert.equal(startDelete.phase, 'deleting')

    const deleted = typewriterStep({ text: 'H', messageIndex: 0, phase: 'deleting', messages: ['Hi', 'Bye'] })
    assert.deepEqual(deleted, { text: '', messageIndex: 0, phase: 'deleting' })

    const next = typewriterStep({ text: '', messageIndex: 0, phase: 'deleting', messages: ['Hi', 'Bye'] })
    assert.deepEqual(next, { text: '', messageIndex: 1, phase: 'typing' })
  })
})

describe('typewriterDelayMs', () => {
  it('uses a medium type speed, faster delete, and a short hold', () => {
    assert.equal(typewriterDelayMs('typing'), 38)
    assert.equal(typewriterDelayMs('deleting'), 22)
    assert.equal(typewriterDelayMs('holding'), 1200)
  })
})
