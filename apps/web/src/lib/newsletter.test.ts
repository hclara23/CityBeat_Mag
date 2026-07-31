import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NEWSLETTER_POLICY_VERSION,
  buildSubscriberRecord,
  emailHash,
  isSuppressedStatus,
  mintUnsubToken,
  newsletterDefaultChecked,
  normalizeNewsletterEmail,
  verifyUnsubToken,
} from './newsletter'

test('emails are normalized (trim + lowercase)', () => {
  assert.equal(normalizeNewsletterEmail('  Owner@Shop.COM '), 'owner@shop.com')
  assert.equal(normalizeNewsletterEmail(null), '')
})

test('emailHash is deterministic and opaque (never contains the email)', () => {
  const h = emailHash('owner@shop.com')
  assert.match(h, /^[a-f0-9]{64}$/)
  assert.equal(h, emailHash('owner@shop.com'))
  assert.notEqual(h, emailHash('other@shop.com'))
  assert.ok(!h.includes('owner'))
})

test('unsubscribe token round-trips, hides the email, and rejects tampering', () => {
  const email = 'owner@shop.com'
  const token = mintUnsubToken(email)
  // Reveals only the hash, never the address.
  assert.ok(!token.includes('owner@shop.com'))
  assert.equal(verifyUnsubToken(token), emailHash(email))
  // Tamper / forge → rejected.
  assert.equal(verifyUnsubToken(token.slice(0, -2) + 'zz'), null)
  assert.equal(verifyUnsubToken(emailHash(email) + '.deadbeef'), null)
  assert.equal(verifyUnsubToken('not-a-token'), null)
  assert.equal(verifyUnsubToken(''), null)
  assert.equal(verifyUnsubToken(null), null)
})

test('suppressed statuses are recognized', () => {
  assert.equal(isSuppressedStatus('unsubscribed'), true)
  assert.equal(isSuppressedStatus('complained'), true)
  assert.equal(isSuppressedStatus('bounced'), true)
  assert.equal(isSuppressedStatus('active'), false)
  assert.equal(isSuppressedStatus(undefined), false)
})

test('subscriber record captures consent metadata', () => {
  const rec = buildSubscriberRecord({
    email: 'Owner@Shop.com',
    locale: 'es',
    source: 'signup',
    method: 'account_signup',
    userId: 'u1',
    listingIds: ['l1'],
    now: '2026-07-31T00:00:00.000Z',
  })
  assert.equal(rec.email_normalized, 'owner@shop.com')
  assert.equal(rec.email_display, 'Owner@Shop.com')
  assert.equal(rec.email_hash, emailHash('owner@shop.com'))
  assert.equal(rec.status, 'active')
  assert.equal(rec.newsletter_opt_in, true)
  assert.equal(rec.consent_locale, 'es')
  assert.equal(rec.consent_source, 'signup')
  assert.equal(rec.consent_policy_version, NEWSLETTER_POLICY_VERSION)
  assert.equal(rec.user_id, 'u1')
  assert.deepEqual(rec.listing_ids, ['l1'])
})

test('checkbox default: US opt-out preselects, affirmative-opt-in jurisdictions do not', () => {
  assert.equal(newsletterDefaultChecked(), true)
  assert.equal(newsletterDefaultChecked('us_opt_out'), true)
  assert.equal(newsletterDefaultChecked('affirmative_opt_in'), false)
})
