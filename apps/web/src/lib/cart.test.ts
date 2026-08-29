import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planCart, toStripeLineItems, isSelfServeCartEligibleId, MAX_CART_ITEMS, type CartItem } from './cart'

test('self-serve eligibility bars directory, custom, and free; allows ads/events/jobs', () => {
  // Barred families
  assert.equal(isSelfServeCartEligibleId('directory_premium_monthly'), false)
  assert.equal(isSelfServeCartEligibleId('directory_founding_annual'), false)
  assert.equal(isSelfServeCartEligibleId('custom_one_time'), false)
  assert.equal(isSelfServeCartEligibleId('directory_basic_free'), false)
  // Unknown id
  assert.equal(isSelfServeCartEligibleId('made_up'), false)
  // Allowed
  assert.equal(isSelfServeCartEligibleId('ad_sponsored_story'), true)
  assert.equal(isSelfServeCartEligibleId('ad_social_promotion'), true)
  assert.equal(isSelfServeCartEligibleId('event_featured'), true)
  assert.equal(isSelfServeCartEligibleId('job_posting_30_day'), true)
})

test('rejects empty, oversized, unknown, free, duplicate, and bad-amount carts', () => {
  assert.equal(planCart([]).ok, false)
  assert.equal((planCart([]) as any).reason, 'empty_cart')
  assert.equal(planCart(new Array(MAX_CART_ITEMS + 1).fill({ productId: 'ad_sponsored_story' })).ok, false)
  assert.equal((planCart([{ productId: 'made_up' }]) as any).reason.startsWith('unknown_product'), true)
  assert.equal((planCart([{ productId: 'directory_basic_free' }]) as any).reason.startsWith('free_product'), true)
  assert.equal(
    (planCart([{ productId: 'ad_sponsored_story' }, { productId: 'ad_sponsored_story' }]) as any).reason.startsWith('duplicate_product'),
    true
  )
  // custom product with no amount → invalid
  assert.equal((planCart([{ productId: 'custom_one_time' }]) as any).reason.startsWith('invalid_amount'), true)
})

test('all one-time items → a single payment-mode session', () => {
  const plan = planCart([{ productId: 'ad_sponsored_story' }, { productId: 'event_featured' }, { productId: 'job_posting_30_day' }])
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  assert.equal(plan.mode, 'payment')
  assert.equal(plan.hasRecurring, false)
  assert.equal(plan.lineItems.length, 3)
  assert.equal(plan.lineItems.every((l) => l.recurring === null), true)
  // 3000 + 2500 + 5000
  assert.equal(plan.total, 10500)
})

test('multiple monthly subscriptions → one subscription-mode session, one interval', () => {
  const plan = planCart([{ productId: 'directory_premium_monthly' }, { productId: 'ad_social_promotion' }, { productId: 'ad_category_banner' }])
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  assert.equal(plan.mode, 'subscription')
  assert.equal(plan.hasRecurring, true)
  assert.equal(plan.lineItems.every((l) => l.recurring?.interval === 'month'), true)
})

test('subscription + one-time add-on → subscription mode; add-on rides the first invoice', () => {
  const plan = planCart([{ productId: 'directory_premium_monthly' }, { productId: 'ad_sponsored_story' }])
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  assert.equal(plan.mode, 'subscription')
  assert.ok(plan.warnings.includes('one_time_items_billed_on_first_invoice'))
  const story = plan.lineItems.find((l) => l.productId === 'ad_sponsored_story')!
  assert.equal(story.recurring, null) // one-time → no recurring → first invoice only
  const prem = plan.lineItems.find((l) => l.productId === 'directory_premium_monthly')!
  assert.equal(prem.recurring?.interval, 'month')
})

test('mixing monthly + annual subscriptions is rejected (one session can hold only one interval)', () => {
  const plan = planCart([{ productId: 'directory_premium_monthly' }, { productId: 'directory_premium_annual' }])
  assert.equal(plan.ok, false)
  assert.equal((plan as any).reason, 'mixed_recurring_intervals')
})

test('custom product with a valid amount is priced from the entered dollars', () => {
  const plan = planCart([{ productId: 'custom_one_time', customAmount: 149.95 }])
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  assert.equal(plan.mode, 'payment')
  assert.equal(plan.lineItems[0].amount, 14995)
})

test('toStripeLineItems emits dynamic price_data with product id metadata + recurring only for subs', () => {
  const plan = planCart([{ productId: 'directory_premium_monthly' }, { productId: 'ad_sponsored_story' }])
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  const li = toStripeLineItems(plan)
  assert.equal(li.length, 2)
  for (const item of li) {
    assert.equal(item.quantity, 1)
    assert.equal(item.price_data.currency, 'usd')
    assert.ok(item.price_data.product_data.metadata.product_id)
  }
  const sub = li.find((x) => x.price_data.product_data.metadata.product_id === 'directory_premium_monthly')!
  assert.deepEqual((sub.price_data as any).recurring, { interval: 'month' })
  const once = li.find((x) => x.price_data.product_data.metadata.product_id === 'ad_sponsored_story')!
  assert.equal((once.price_data as any).recurring, undefined)
})
