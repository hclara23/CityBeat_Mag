import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canReserve, parseCaption, parseReview, safeNotes, OFFICIAL_PAGE_ID } from './social-queue-policy'

test('monthly reservation fails closed at the approved ceiling', () => {
  assert.equal(canReserve(0), true)
  assert.equal(canReserve(496), true)
  for (const value of [497, 500, NaN, Infinity, -1]) assert.equal(canReserve(value), false)
  assert.equal(OFFICIAL_PAGE_ID, '112338362142224')
})
test('review is a strict boolean, not truthy text', () => {
  assert.deepEqual(parseReview({ approved: false, reason: 'Unverified date' }), { approved: false, reason: 'Unverified date' })
  for (const value of [null, {}, { approved: 'true', reason: 'ok' }, { approved: true, reason: '' }]) assert.throws(() => parseReview(value))
})
test('captions and notes are bounded', () => {
  assert.equal(parseCaption({ caption: ' Hello ' }), 'Hello')
  assert.throws(() => parseCaption({ caption: '' }))
  assert.throws(() => parseCaption({ caption: 'a'.repeat(1201) }))
  assert.equal(safeNotes('a'.repeat(2000)).length, 1000)
  assert.equal(safeNotes({}), '')
})
