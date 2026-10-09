import test from 'node:test'
import assert from 'node:assert/strict'
import { foundersCheckoutAllowed, foundersPaymentConfirmed, foundersReturnPaths, normalizeBusinessKey, parseFoundersBusiness } from './founders-onboarding'
import { directoryBillingQuantity } from './sales-checkout'

const input = { name: 'Example Clinic', category: 'Health', phone: '915-555-0100', addresses: ['123 Main Street, El Paso TX 79901'], website: 'https://example.com', hours: { Monday: '9–5' }, attested: true }
test('payment confirmation requires paid subscription, exact plan amount and one Founders billing unit', () => {
  const session = { metadata: { source: 'founders_funnel', plan: 'founding', billing_quantity: '1' }, mode: 'subscription', payment_status: 'paid', currency: 'usd', subscription: 'sub_test', amount_subtotal: 999 }
  assert.equal(foundersPaymentConfirmed(session), true)
  assert.equal(foundersPaymentConfirmed({ ...session, payment_status: 'unpaid' }), false)
  assert.equal(foundersPaymentConfirmed({ ...session, amount_subtotal: 2997, metadata: { ...session.metadata, billing_quantity: '3' } }), false)
  assert.equal(foundersPaymentConfirmed({ ...session, metadata: { source: 'founders_funnel', plan: 'premium_monthly', billing_quantity: '3' }, amount_subtotal: 5997 }), true)
  assert.equal(foundersPaymentConfirmed({ ...session, currency: 'eur' }), false)
})
test('new business input cannot smuggle privileges or billing fields', () => {
  const data: any = parseFoundersBusiness({ ...input, tier: 'premium', owner_id: 'attacker', is_published: true, stripe_subscription_id: 'sub_fake', claimed_at: 'today' })
  for (const key of ['tier', 'owner_id', 'is_published', 'stripe_subscription_id', 'claimed_at']) assert.equal(data[key], undefined)
  assert.equal(data.location_count, 1)
  assert.deepEqual(data.hours, { Monday: '9–5' })
})
test('creation requires representation attestation, usable contact details and distinct locations', () => {
  assert.throws(() => parseFoundersBusiness({ ...input, attested: false }))
  assert.throws(() => parseFoundersBusiness({ ...input, phone: '12' }))
  assert.throws(() => parseFoundersBusiness({ ...input, addresses: [] }))
  assert.throws(() => parseFoundersBusiness({ ...input, addresses: Array(11).fill('123 Main Street') }))
  assert.throws(() => parseFoundersBusiness({ ...input, addresses: ['123 Main Street', '123 main street!'] }))
})
test('URL inputs reject script and data schemes; unknown hours are excluded', () => {
  assert.throws(() => parseFoundersBusiness({ ...input, website: 'javascript:alert(1)' }))
  assert.throws(() => parseFoundersBusiness({ ...input, image_url: 'data:image/png;base64,test' }))
  assert.deepEqual(parseFoundersBusiness({ ...input, hours: { Monday: 'Closed', private: 'secret' } }).hours, { Monday: 'Closed' })
})
test('only an approved owner may start funnel checkout, never a manager or pending claimant', () => {
  assert.equal(foundersCheckoutAllowed({ owner_id: 'a', claim_status: 'approved' }, 'a'), true)
  for (const status of ['pending_approval', 'unclaimed', undefined]) assert.equal(foundersCheckoutAllowed({ owner_id: 'a', claim_status: status }, 'a'), false)
  assert.equal(foundersCheckoutAllowed({ owner_id: 'a', claim_status: 'approved', manager_ids: ['b'] }, 'b'), false)
})
test('payment success returns to dashboard; cancel returns to selected business without granting a tier', () => {
  assert.deepEqual(foundersReturnPaths('en', 'example'), { success: '/en/dashboard?founders_checkout=success', cancel: '/en/founders?listing=example&checkout=cancelled' })
  assert.match(foundersReturnPaths('es', 'a/b').cancel, /listing=a%2Fb/)
  assert.match(foundersReturnPaths('//evil.test', 'abc').success, /^\/en\/dashboard/)
})
test('Founders bills once per business regardless of location count; standard pricing is unchanged', () => {
  for (const location_count of [1, 3, 10, 100]) assert.equal(directoryBillingQuantity({ productFamily: 'directory', billing: 'subscription', listing: { location_count }, founding: true }), 1)
  assert.equal(directoryBillingQuantity({ productFamily: 'directory', billing: 'subscription', listing: { location_count: 3 } }), 3)
  assert.equal(normalizeBusinessKey('Café, LLC'), normalizeBusinessKey('Cafe LLC'))
})
