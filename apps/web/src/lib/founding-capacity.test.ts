import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateFoundingSlot, reconcileFoundingSlot, type FoundingSlot } from './founding-capacity'
const slot = (i: number): FoundingSlot => ({ key: `business${i}`, attempt: `${i}`, state: 'pending' })
test('last Founders place is allocated once; the next business is rejected', () => {
  const initial = Array.from({ length: 99 }, (_, i) => slot(i))
  const first = allocateFoundingSlot(initial, slot(99))
  assert.equal(first.slots.length, 100)
  assert.throws(() => allocateFoundingSlot(first.slots, slot(100)), /100/)
  assert.equal(allocateFoundingSlot(first.slots, slot(99)).slots.length, 100)
})
test('time alone cannot release a reservation; only matching confirmed unpaid expiry does', () => {
  const reserved: FoundingSlot = { ...slot(1), state: 'open', sessionId: 'cs_one', expiresAt: 1 }
  assert.deepEqual(reconcileFoundingSlot(reserved, { id: 'other', status: 'expired' }), reserved)
  assert.deepEqual(reconcileFoundingSlot(reserved, { id: 'cs_one', status: 'open' }), reserved)
  assert.equal(reconcileFoundingSlot(reserved, { id: 'cs_one', status: 'expired', payment_status: 'unpaid' }), null)
  assert.equal(reconcileFoundingSlot(reserved, { id: 'cs_one', status: 'complete', payment_status: 'paid' })?.state, 'paid')
  assert.equal(reconcileFoundingSlot({ ...reserved, state: 'paid' }, { id: 'cs_one', status: 'expired' })?.state, 'paid')
})
