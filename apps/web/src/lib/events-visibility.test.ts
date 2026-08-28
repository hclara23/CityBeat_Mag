import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isEventVisible } from './events'

test('legacy events with no status remain public', () => {
  assert.equal(isEventVisible({}), true)
  assert.equal(isEventVisible({ status: undefined }), true)
  assert.equal(isEventVisible({ status: '' }), true)
})

test('approved is the only explicit public status', () => {
  assert.equal(isEventVisible({ status: 'approved' }), true)
  assert.equal(isEventVisible({ status: 'pending' }), false)
  assert.equal(isEventVisible({ status: 'rejected' }), false)
})

test('the regression: a refund stamp must HIDE the event, not publish it', () => {
  // The Stripe refund path writes status 'needs_attention'; under the old
  // deny-list that made a refunded paid event publicly visible — and
  // featured:true pinned it to the top of /events.
  assert.equal(isEventVisible({ status: 'needs_attention' }), false)
})

test('unknown statuses default to hidden (allow-list)', () => {
  assert.equal(isEventVisible({ status: 'zzz' }), false)
  assert.equal(isEventVisible({ status: 42 as unknown as string }), false)
})
