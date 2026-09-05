import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SALES_ORDER_ACCESS_DAYS,
  buildSalesOrderRecord,
  createSalesOrderAccess,
  hashSalesOrderToken,
  salesOrderAccessExpired,
  salesOrderAccessExpiresAt,
  salesOrderCheckoutUrls,
  salesOrderHandoffMatches,
  salesOrderTokenMatches,
} from './sales-orders'
import { SALES_PRODUCTS } from './sales-products'

// This module guards a paid order: who is credited the commission, whether a
// bearer token opens someone's fulfilment brief, and whether a "pay here" link
// really points at Stripe. It moves money and had no tests.

test('an access token is random, hashed at rest, and only its own token opens it', () => {
  const a = createSalesOrderAccess()
  const b = createSalesOrderAccess()
  assert.notEqual(a.token, b.token, 'tokens must not repeat')
  assert.match(a.tokenHash, /^[a-f0-9]{64}$/)
  // The plaintext token is never what we store.
  assert.notEqual(a.token, a.tokenHash)
  assert.equal(a.tokenHash, hashSalesOrderToken(a.token))

  assert.equal(salesOrderTokenMatches(a.token, a.tokenHash), true)
  // Another order's token must never open this one.
  assert.equal(salesOrderTokenMatches(b.token, a.tokenHash), false)
  assert.equal(salesOrderTokenMatches('', a.tokenHash), false)
})

test('a malformed or missing stored hash never authorizes', () => {
  const { token } = createSalesOrderAccess()
  // A doc with no/garbage hash must fail closed rather than throw or pass.
  for (const bad of [undefined, null, '', 'not-a-hash', 'a'.repeat(63), 'A'.repeat(64), 123, {}]) {
    assert.equal(salesOrderTokenMatches(token, bad as unknown), false, `hash ${String(bad)} must not authorize`)
  }
})

test('access expiry fails closed on anything unparseable', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  const future = salesOrderAccessExpiresAt(now)
  assert.equal(salesOrderAccessExpired(future, now), false)

  // Exactly the documented window.
  const days = (Date.parse(future) - now.getTime()) / 86400000
  assert.equal(days, SALES_ORDER_ACCESS_DAYS)

  // One day past the window.
  assert.equal(salesOrderAccessExpired(future, new Date('2026-02-05T00:00:00Z')), true)
  // Missing/garbage values must be treated as EXPIRED, never as valid.
  for (const bad of [undefined, null, '', 'yesterday', 0, {}]) {
    assert.equal(salesOrderAccessExpired(bad as unknown, now), true, `${String(bad)} must count as expired`)
  }
})

test('a new order credits commission to the seller and starts unpaid', () => {
  const product = SALES_PRODUCTS.ad_sponsored_story
  const now = new Date('2026-01-01T00:00:00Z')
  const rec = buildSalesOrderRecord({
    product,
    amount: 3000,
    businessName: 'Tacos El Rey',
    contactEmail: 'owner@tacos.com',
    locale: 'en',
    sellerUserId: 'rep-1',
    tokenHash: 'f'.repeat(64),
    now,
  }) as any

  // Commission attribution is the thing Stripe does NOT hold — if this is wrong
  // the rep is never paid and it cannot be reconstructed from the charge.
  assert.equal(rec.sold_by, 'rep-1')
  assert.equal(rec.payout_user_id, 'rep-1')

  // Money must start unpaid and unfulfilled, never optimistically complete.
  assert.equal(rec.payment_status, 'pending')
  assert.equal(rec.fulfillment_status, 'awaiting_payment')
  assert.equal(rec.intake_status, 'not_started')

  assert.equal(rec.amount, 3000)
  assert.equal(rec.currency, 'usd')
  assert.equal(rec.product_id, product.id)
  assert.equal(rec.intake_token_hash, 'f'.repeat(64))
  assert.equal(salesOrderAccessExpired(rec.intake_expires_at, now), false)
})

test('a self-serve order carries NO payout attribution', () => {
  // The cart passes an empty seller; the caller then nulls these. If this ever
  // returned a truthy payout_user_id, self-serve sales would accrue commission
  // to someone who did not sell them.
  const rec = buildSalesOrderRecord({
    product: SALES_PRODUCTS.ad_sponsored_story,
    amount: 3000,
    businessName: 'x',
    contactEmail: 'x@y.com',
    locale: 'en',
    sellerUserId: '',
    tokenHash: 'a'.repeat(64),
  }) as any
  assert.ok(!rec.sold_by, 'empty seller must not become an attribution')
  assert.ok(!rec.payout_user_id)
})

test('a handoff link is only honored for a live Stripe URL owned by that seller', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  const good = {
    sold_by: 'rep-1',
    checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    checkout_status: 'ready',
    checkout_expires_at: '2026-01-02T00:00:00Z',
    id: 'order-1',
  }
  const base = { order: good, sellerUserId: 'rep-1', checkoutUrl: good.checkout_url, now }
  assert.equal(salesOrderHandoffMatches(base), true)

  // A different rep cannot claim someone else's sale.
  assert.equal(salesOrderHandoffMatches({ ...base, sellerUserId: 'rep-2' }), false)
  // The URL must be the one actually recorded on the order.
  assert.equal(salesOrderHandoffMatches({ ...base, checkoutUrl: 'https://checkout.stripe.com/c/pay/other' }), false)
  // Not ready / already consumed.
  assert.equal(
    salesOrderHandoffMatches({ ...base, order: { ...good, checkout_status: 'completed' } }),
    false
  )
  // Expired link.
  assert.equal(salesOrderHandoffMatches({ ...base, now: new Date('2026-02-01T00:00:00Z') }), false)
})

test('a handoff refuses any non-Stripe or insecure host (phishing guard)', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  const mk = (url: string) => ({
    order: {
      sold_by: 'rep-1',
      checkout_url: url,
      checkout_status: 'ready',
      checkout_expires_at: '2026-01-02T00:00:00Z',
    },
    sellerUserId: 'rep-1',
    checkoutUrl: url,
    now,
  })
  // A rep showing a customer a QR code must never be able to point it anywhere
  // but Stripe — this is the difference between a payment and a stolen card.
  assert.equal(salesOrderHandoffMatches(mk('https://checkout.stripe.com/c/pay/x')), true)
  assert.equal(salesOrderHandoffMatches(mk('https://buy.stripe.com/x')), true)
  assert.equal(salesOrderHandoffMatches(mk('http://checkout.stripe.com/c/pay/x')), false, 'http must be rejected')
  assert.equal(salesOrderHandoffMatches(mk('https://checkout.stripe.com.evil.tld/pay')), false)
  assert.equal(salesOrderHandoffMatches(mk('https://evil.tld/checkout.stripe.com')), false)
  assert.equal(salesOrderHandoffMatches(mk('javascript:alert(1)')), false)
  assert.equal(salesOrderHandoffMatches(mk('not a url')), false)
})

test('checkout return URLs stay on our origin and carry the access token safely', () => {
  const token = 'tok/with+special=chars'
  const urls = salesOrderCheckoutUrls({
    origin: 'https://citybeatmag.co',
    locale: 'es',
    orderId: 'order 1/2',
    token,
    billing: 'subscription',
  })
  // Both must point back at us — a redirect off-origin after payment is a
  // phishing vector.
  assert.ok(urls.successUrl.startsWith('https://citybeatmag.co/'))
  assert.ok(urls.cancelUrl.startsWith('https://citybeatmag.co/'))
  // Ids and tokens are encoded, so a slash cannot forge a different path.
  assert.ok(!urls.successUrl.includes('order 1/2'))
  assert.ok(!urls.successUrl.includes(token))
  assert.ok(urls.successUrl.includes(encodeURIComponent(token)))
  // Stripe fills the session id server-side.
  assert.ok(urls.successUrl.includes('{CHECKOUT_SESSION_ID}'))
  assert.ok(urls.successUrl.includes('/es/'))
})
