import test from 'node:test'
import assert from 'node:assert/strict'
import { createSalesOrderAccess } from './sales-orders'
import { validIntakeAccess, intakeRecoveryError } from './intake-recovery'

test('recovery preserves the original token and checks each expiry independently', () => {
  const original = createSalesOrderAccess(), recovery = createSalesOrderAccess()
  const now = new Date('2026-10-27T12:00:00Z')
  const order = {
    intake_token_hash: original.tokenHash, intake_expires_at: '2026-11-01T00:00:00Z',
    intake_recovery_token_hash: recovery.tokenHash, intake_recovery_expires_at: '2026-11-26T00:00:00Z',
  }
  assert.equal(validIntakeAccess(order, original.token, now), true)
  assert.equal(validIntakeAccess(order, recovery.token, now), true)
  assert.equal(validIntakeAccess(order, 'wrong', now), false)
  order.intake_expires_at = '2026-09-01T00:00:00Z'
  assert.equal(validIntakeAccess(order, original.token, now), false)
  assert.equal(validIntakeAccess(order, recovery.token, now), true)
  order.intake_recovery_expires_at = 'invalid'
  assert.equal(validIntakeAccess(order, recovery.token, now), false)
})

test('recovery cannot revive unpaid, refunded, completed, or canceled orders', () => {
  const paid = { payment_status: 'paid', billing_status: 'active', fulfillment_status: 'awaiting_intake', intake_status: 'in_progress' }
  assert.equal(intakeRecoveryError(paid), null)
  for (const patch of [{ payment_status: 'pending' }, { payment_status: 'refunded' }, { billing_status: 'canceled' }, { intake_status: 'submitted' }, { fulfillment_status: 'fulfilled' }]) {
    assert.ok(intakeRecoveryError({ ...paid, ...patch }))
  }
})
