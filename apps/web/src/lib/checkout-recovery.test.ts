import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RECOVERY_WINDOW_DAYS,
  checkoutLinkState,
  isRecoverable,
  planRecovery,
  recoveryEmail,
} from './checkout-recovery'

const NOW = '2026-08-27T18:00:00.000Z'

test('a paid or completed order is never treated as a dead link', () => {
  assert.equal(checkoutLinkState({ payment_status: 'paid', checkout_status: 'ready' }, NOW), 'paid')
  assert.equal(checkoutLinkState({ checkout_status: 'completed' }, NOW), 'completed')
})

test('expiry is derived from the clock, not from the stored status', () => {
  // This is the exact live case: 11 orders claimed `ready` while Stripe had
  // already expired every one of them.
  const dead = {
    checkout_status: 'ready',
    checkout_url: 'https://checkout.stripe.com/x',
    checkout_expires_at: '2026-08-21T15:30:37.000Z',
  }
  assert.equal(checkoutLinkState(dead, NOW), 'expired')

  const live = {
    checkout_status: 'ready',
    checkout_url: 'https://checkout.stripe.com/x',
    checkout_expires_at: '2026-08-28T15:30:37.000Z',
  }
  assert.equal(checkoutLinkState(live, NOW), 'ready')
})

test('orders with no stored expiry fall back to Stripe\'s 24h session default', () => {
  const old = { checkout_status: 'ready', checkout_url: 'u', created_at: '2026-08-25T00:00:00.000Z' }
  assert.equal(checkoutLinkState(old, NOW), 'expired')
  const fresh = { checkout_status: 'ready', checkout_url: 'u', created_at: '2026-08-27T12:00:00.000Z' }
  assert.equal(checkoutLinkState(fresh, NOW), 'ready')
  // Unknown creation time must not be guessed into 'expired'.
  assert.equal(checkoutLinkState({ checkout_status: 'ready', checkout_url: 'u' }, NOW), 'ready')
})

test('an order that never had a checkout link is not a dead link', () => {
  assert.equal(checkoutLinkState({ checkout_status: 'ready' }, NOW), 'none')
})

test('a customer is chased once, recently, and only with a real address', () => {
  const base = {
    checkout_status: 'ready',
    checkout_url: 'u',
    checkout_expires_at: '2026-08-21T15:30:37.000Z',
    contact_email: 'owner@example.com',
  }
  assert.equal(isRecoverable(base, NOW), true)
  // Never twice.
  assert.equal(isRecoverable({ ...base, recovery_emailed_at: '2026-08-22T00:00:00.000Z' }, NOW), false)
  // Never without a usable address.
  assert.equal(isRecoverable({ ...base, contact_email: '' }, NOW), false)
  assert.equal(isRecoverable({ ...base, contact_email: 'not-an-email' }, NOW), false)
  // Never once it is a cold lead rather than an abandoned checkout.
  const stale = { ...base, checkout_expires_at: '2026-05-01T00:00:00.000Z' }
  assert.equal(isRecoverable(stale, NOW), false)
  assert.equal(RECOVERY_WINDOW_DAYS, 45)
  // Never chase something already paid.
  assert.equal(isRecoverable({ ...base, payment_status: 'paid' }, NOW), false)
  // Never chase a lead a rep explicitly Removed from the board.
  assert.equal(isRecoverable({ ...base, recovery_dismissed: true }, NOW), false)
})

test('planRecovery separates marking the truth from contacting a person', () => {
  const orders = [
    { id: 'live', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-28T00:00:00.000Z', contact_email: 'a@b.com' },
    { id: 'dead', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-21T00:00:00.000Z', contact_email: 'a@b.com' },
    { id: 'dead-no-email', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-21T00:00:00.000Z' },
    // Distinct contacts: the per-customer suppression rules have their own
    // tests below; this test is about marking-vs-contacting separation.
    { id: 'already-marked', checkout_status: 'expired', checkout_url: 'u', checkout_expires_at: '2026-08-21T00:00:00.000Z', contact_email: 'c@d.com', recovery_emailed_at: '2026-08-22T00:00:00.000Z' },
    { id: 'paid', payment_status: 'paid', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-01T00:00:00.000Z', contact_email: 'e@f.com' },
  ]
  const plan = planRecovery(orders, NOW)
  // Dead links get marked even when nobody can be emailed about them...
  assert.deepEqual(plan.toExpire.sort(), ['dead', 'dead-no-email'])
  // ...but only a contactable, not-yet-chased person is emailed.
  assert.deepEqual(plan.toEmail.map((o) => o.id), ['dead'])
  // Re-running is idempotent: nothing already marked is rewritten, nobody re-emailed.
  const second = planRecovery(
    orders.map((o) => (o.id === 'dead' ? { ...o, checkout_status: 'expired', recovery_emailed_at: NOW } : o)),
    NOW
  )
  assert.deepEqual(second.toExpire, ['dead-no-email'])
  assert.deepEqual(second.toEmail, [])
})

test('the nudge is per CUSTOMER: duplicate orders collapse to one email', () => {
  const orders = [
    { id: 'a', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-21T00:00:00.000Z', contact_email: 'A@b.com' },
    { id: 'b', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-21T00:00:00.000Z', contact_email: 'a@B.com' },
  ]
  const plan = planRecovery(orders, NOW)
  // Both dead links get marked; only ONE email per contact (case-insensitive).
  assert.deepEqual(plan.toExpire.sort(), ['a', 'b'])
  assert.deepEqual(plan.toEmail.map((o) => o.id), ['a'])
})

test('a customer who paid on a sibling order is never nudged about a dead one', () => {
  const orders = [
    { id: 'dead', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-21T00:00:00.000Z', contact_email: 'x@y.com' },
    // The re-issued link they actually paid on ("Correct details" flow).
    { id: 'paid', payment_status: 'paid', checkout_status: 'completed', checkout_url: 'u', contact_email: 'X@Y.com ' },
  ]
  const plan = planRecovery(orders, NOW)
  assert.deepEqual(plan.toExpire, ['dead']) // marking is still per order
  assert.deepEqual(plan.toEmail, [])
})

test('excludeEmails removes a customer from emailing but not from marking', () => {
  const orders = [
    { id: 'dead', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-21T00:00:00.000Z', contact_email: 'done@biz.com' },
  ]
  const plan = planRecovery(orders, NOW, { excludeEmails: [' DONE@BIZ.com'] })
  assert.deepEqual(plan.toExpire, ['dead'])
  assert.deepEqual(plan.toEmail, [])
})

test('an already-nudged sibling suppresses a second email to the same customer', () => {
  const orders = [
    { id: 'old', checkout_status: 'expired', checkout_url: 'u', checkout_expires_at: '2026-08-20T00:00:00.000Z', contact_email: 'n@z.com', recovery_emailed_at: '2026-08-22T00:00:00.000Z' },
    { id: 'newer', checkout_status: 'ready', checkout_url: 'u', checkout_expires_at: '2026-08-21T00:00:00.000Z', contact_email: 'n@z.com' },
  ]
  const plan = planRecovery(orders, NOW)
  assert.deepEqual(plan.toExpire, ['newer'])
  assert.deepEqual(plan.toEmail, [])
})

test('the nudge is bilingual, escapes user data, and never links a dead session', () => {
  const en = recoveryEmail({ businessName: 'Varsity Roofing', productName: 'Founding Monthly', locale: 'en' })
  assert.match(en.subject, /Varsity Roofing/)
  assert.match(en.html, /Founding Monthly/)
  // The old Stripe session is dead; linking to it would land on an error page.
  assert.equal(/checkout\.stripe\.com/.test(en.html), false)
  assert.match(en.html, /reply/i)

  const es = recoveryEmail({ businessName: 'Casita Linda', productName: 'Founding Monthly', locale: 'es' })
  assert.match(es.subject, /Casita Linda/)
  assert.match(es.html, /responde/i)

  // A business name is customer-supplied text and must not inject markup.
  const nasty = recoveryEmail({ businessName: '<script>alert(1)</script>', productName: 'x', locale: 'en' })
  assert.equal(/<script>/.test(nasty.html), false)
  assert.match(nasty.html, /&lt;script&gt;/)
})
