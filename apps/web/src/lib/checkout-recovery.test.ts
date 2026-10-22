import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RECOVERY_WINDOW_DAYS, RECOVERY_WINDOW_MAX_DAYS, checkoutLinkState, isRecoverable, planRecovery, recoveryEmail, resolveRecoveryWindowDays } from './checkout-recovery'

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

// --- The catch-up window ------------------------------------------------------
//
// Thirteen abandoned checkouts worth $219.88 piled up while recovery email was
// switched off, and eleven aged past the 45-day window into being permanently
// unreachable. ?days= exists to clear a known backlog once — not to loosen the
// standing policy, and not to let anyone chase a year-old lead by accident.

test('the standing policy is the default, not the maximum', () => {
  assert.equal(resolveRecoveryWindowDays(undefined), RECOVERY_WINDOW_DAYS)
  assert.equal(resolveRecoveryWindowDays(null), RECOVERY_WINDOW_DAYS)
  assert.equal(resolveRecoveryWindowDays(''), RECOVERY_WINDOW_DAYS)
})

test('garbage falls back to the standing policy, never to the maximum', () => {
  // The dangerous failure: "?days=abc" quietly meaning "chase everyone, forever".
  for (const bad of ['abc', '-5', '0', 'NaN', {}, [], '1e999']) {
    assert.equal(resolveRecoveryWindowDays(bad as any), RECOVERY_WINDOW_DAYS, `${JSON.stringify(bad)}`)
  }
})

test('a requested window is honoured but clamped', () => {
  assert.equal(resolveRecoveryWindowDays(120), 120)
  assert.equal(resolveRecoveryWindowDays('120'), 120)
  assert.equal(resolveRecoveryWindowDays(90.9), 90, 'floored, not rounded up')
  assert.equal(resolveRecoveryWindowDays(99999), RECOVERY_WINDOW_MAX_DAYS)
})

test('a widened window reaches an order the default cannot', () => {
  const now = new Date('2026-10-22T00:00:00.000Z')
  const order = {
    id: 'o1',
    payment_status: 'pending',
    contact_email: 'owner@example.com',
    created_at: '2026-08-20T00:00:00.000Z',
    checkout_expires_at: '2026-08-21T00:00:00.000Z',
    checkout_url: 'https://checkout.stripe.com/c/pay/test',
  }
  assert.equal(isRecoverable(order, now), false, '62 days old: outside the 45-day default')
  assert.equal(isRecoverable(order, now, 120), true, 'inside a deliberate 120-day catch-up')
})

test('widening the window does NOT bypass any other guard', () => {
  // The whole risk of this feature: an operator clearing a backlog must not be
  // able to re-nudge someone who declined, was dismissed by a rep, or paid.
  const now = new Date('2026-10-22T00:00:00.000Z')
  const base = {
    id: 'o1',
    payment_status: 'pending',
    contact_email: 'owner@example.com',
    created_at: '2026-08-20T00:00:00.000Z',
    checkout_expires_at: '2026-08-21T00:00:00.000Z',
    checkout_url: 'https://checkout.stripe.com/c/pay/test',
  }
  assert.equal(isRecoverable({ ...base, recovery_emailed_at: '2026-09-01' }, now, 365), false, 'already nudged')
  assert.equal(isRecoverable({ ...base, recovery_dismissed: true }, now, 365), false, 'rep dismissed it')
  assert.equal(isRecoverable({ ...base, payment_status: 'paid' }, now, 365), false, 'they paid')
  assert.equal(isRecoverable({ ...base, contact_email: 'nope' }, now, 365), false, 'no usable address')
})

test('planRecovery still excludes a customer who paid on a sibling order, however wide the window', () => {
  const now = new Date('2026-10-22T00:00:00.000Z')
  const orders = [
    {
      id: 'old-unpaid',
      payment_status: 'pending',
      contact_email: 'same@example.com',
      created_at: '2026-07-30T00:00:00.000Z',
      checkout_expires_at: '2026-07-31T00:00:00.000Z',
      checkout_url: 'https://checkout.stripe.com/c/pay/test',
    },
  ]
  const wide = planRecovery(orders, now, { windowDays: 365, excludeEmails: ['same@example.com'] })
  assert.deepEqual(wide.toEmail.map((o) => o.id), [], 'a converted contact is never nudged')
})

test('an order with no checkout link at all is never nudged, at any window', () => {
  // There is nothing to recover: no link was ever minted, so "your payment link
  // expired" would be a lie. Found by a fixture of mine that omitted the link
  // and failed for this reason rather than the window one.
  const now = new Date('2026-10-22T00:00:00.000Z')
  const noLink = {
    id: 'o-nolink',
    payment_status: 'pending',
    contact_email: 'owner@example.com',
    created_at: '2026-08-20T00:00:00.000Z',
    checkout_expires_at: '2026-08-21T00:00:00.000Z',
  }
  assert.equal(checkoutLinkState(noLink, now), 'none')
  assert.equal(isRecoverable(noLink, now, 365), false)
})
