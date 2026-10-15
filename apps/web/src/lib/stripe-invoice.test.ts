import assert from 'node:assert/strict'
import test from 'node:test'
import { computeSplit, ledgerDocId } from './payout-split'
import { stripeInvoiceSubscriptionId } from './stripe-invoice'

const EDITOR = 'editor-uid-0001'

test('resolves legacy Stripe invoice subscription strings and expanded objects', () => {
  assert.equal(stripeInvoiceSubscriptionId({ subscription: 'sub_legacy' }), 'sub_legacy')
  assert.equal(stripeInvoiceSubscriptionId({ subscription: { id: 'sub_expanded' } }), 'sub_expanded')
})

test('resolves the newer invoice parent subscription_details shape', () => {
  assert.equal(
    stripeInvoiceSubscriptionId({
      parent: { subscription_details: { subscription: 'sub_parent' } },
    }),
    'sub_parent'
  )
  assert.equal(
    stripeInvoiceSubscriptionId({
      parent: { subscription_details: { subscription: { id: 'sub_parent_expanded' } } },
    }),
    'sub_parent_expanded'
  )
})

test('legacy reference wins during a mixed-version transition and invalid shapes are ignored', () => {
  assert.equal(
    stripeInvoiceSubscriptionId({
      subscription: 'sub_legacy',
      parent: { subscription_details: { subscription: 'sub_parent' } },
    }),
    'sub_legacy'
  )
  assert.equal(stripeInvoiceSubscriptionId({ parent: { subscription_details: {} } }), null)
  assert.equal(stripeInvoiceSubscriptionId(null), null)
})

test('$9.99 editor renewal produces one stable idempotent commission share', () => {
  const invoice = {
    id: 'in_september_renewal',
    billing_reason: 'subscription_cycle',
    amount_paid: 999,
    parent: { subscription_details: { subscription: 'sub_monthly' } },
  }
  assert.equal(stripeInvoiceSubscriptionId(invoice), 'sub_monthly')

  const shares = computeSplit('directory', EDITOR, EDITOR)
  assert.deepEqual(shares, [
    { payeeUserId: EDITOR, role: 'editor', percent: 45 },
  ])
  // The webhook passes invoice.id as sourcePaymentId. Duplicate deliveries and
  // reconciliation therefore converge on one ledger row for this renewal.
  const rowIds = shares.map((share) =>
    ledgerDocId('directory', share.payeeUserId, invoice.id)
  )
  assert.deepEqual(rowIds, [`payout:directory:${EDITOR}:${invoice.id}`])
  assert.equal(rowIds[0], ledgerDocId('directory', EDITOR, invoice.id))
})
