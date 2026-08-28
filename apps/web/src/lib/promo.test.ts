import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FOUNDERS_PROMO, foundersOfferEmail, isFoundersPromoEligible } from './promo'

test('founders promo terms are the operator-specified deal', () => {
  assert.equal(FOUNDERS_PROMO.freeMonths, 3)
  assert.equal(FOUNDERS_PROMO.id, 'founders_3mo_free')
  // Links must outlive a 24h Stripe session — that is the whole reason the
  // email points at our own redirect route.
  assert.ok(FOUNDERS_PROMO.tokenDays >= 30)
})

test('only unpaid Founding Monthly subscription orders are eligible', () => {
  const base = { payment_status: 'pending', billing_type: 'subscription', product_id: 'directory_founding_monthly' }
  assert.equal(isFoundersPromoEligible(base), true)
  // Never a paid order, never a one-time product, never a different plan —
  // the email states $9.99 Founding terms and must not be sent for anything else.
  assert.equal(isFoundersPromoEligible({ ...base, payment_status: 'paid' }), false)
  assert.equal(isFoundersPromoEligible({ ...base, billing_type: 'one_time' }), false)
  assert.equal(isFoundersPromoEligible({ ...base, product_id: 'directory_premium_monthly' }), false)
  assert.equal(isFoundersPromoEligible({ ...base, product_id: 'ad_newsletter_sponsorship' }), false)
  assert.equal(isFoundersPromoEligible({}), false)
})

test('the offer email states ALL the billing terms, in the right language(s)', () => {
  const en = foundersOfferEmail({ businessName: 'We Hike Adventure', offerUrl: 'https://citybeatmag.co/api/promo/founders/x?t=y', locale: 'en' })
  assert.match(en.subject, /3 months free/)
  assert.match(en.html, /\$9\.99 for your first month/)
  assert.match(en.html, /months 2, 3 and 4 FREE/)
  // The month-5 resumption MUST be stated — a surprise charge is a chargeback.
  assert.match(en.html, /\$9\.99\/month starting month 5/)
  assert.match(en.html, /cancel anytime/i)
  assert.match(en.html, /citybeatmag\.co\/api\/promo\/founders/)

  const es = foundersOfferEmail({ businessName: 'Casita Linda', offerUrl: 'https://x.co/a', locale: 'es' })
  assert.match(es.subject, /3 meses gratis/)
  assert.match(es.html, /desde el mes 5 son \$9\.99\/mes/)

  const both = foundersOfferEmail({ offerUrl: 'https://x.co/a' })
  assert.match(both.html, /starting month 5/)
  assert.match(both.html, /desde el mes 5/)
})

test('business names cannot inject markup into the offer', () => {
  const nasty = foundersOfferEmail({ businessName: '<img src=x onerror=1>', offerUrl: 'https://x.co/a', locale: 'en' })
  assert.equal(/<img src=x/.test(nasty.html), false)
  assert.match(nasty.html, /&lt;img/)
})
