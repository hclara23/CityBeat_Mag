import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SALES_PRODUCTS,
  SALES_PRODUCT_ORDER,
  getSalesProduct,
  resolveSalesProductRequest,
  salesProductAmount,
} from './sales-products'
import { getSalesIntakeSchema } from './sales-intake'
import { salesFulfillmentTarget } from './sales-fulfillment'

// The invariant that prevents a "customer paid, nothing happens" dead-end: every
// sellable product must resolve to BOTH an intake form and a fulfillment target.
test('every product intakeKind has an intake schema and a fulfillment target', () => {
  for (const id of SALES_PRODUCT_ORDER) {
    const p = SALES_PRODUCTS[id]
    assert.ok(p, `missing product ${id}`)
    // Free basic listing has no paid intake/fulfillment brief — skip it.
    if (p.billing === 'free') continue
    const schema = getSalesIntakeSchema(p.intakeKind)
    assert.ok(schema, `no intake schema for ${id} (${p.intakeKind})`)
    const target = salesFulfillmentTarget({ orderId: 'o1', intakeKind: p.intakeKind })
    assert.ok(target.collection, `no fulfillment target for ${id} (${p.intakeKind})`)
  }
})

test('SALES_PRODUCT_ORDER lists every product exactly once', () => {
  const ids = Object.keys(SALES_PRODUCTS)
  assert.equal(SALES_PRODUCT_ORDER.length, ids.length)
  assert.equal(new Set(SALES_PRODUCT_ORDER).size, SALES_PRODUCT_ORDER.length)
  for (const id of ids) assert.ok(SALES_PRODUCT_ORDER.includes(id as any), `${id} not in order`)
})

test('new Social Media Promotion product is a well-formed advertising subscription', () => {
  const p = getSalesProduct('ad_social_promotion')
  assert.ok(p)
  assert.equal(p!.family, 'advertising')
  assert.equal(p!.intakeKind, 'social_promotion')
  assert.equal(p!.billing, 'subscription')
  assert.equal(p!.interval, 'month')
  assert.equal(p!.unitAmount, 4000)
  // Priced by the fixed unitAmount, not a custom entry.
  assert.equal(salesProductAmount(p!, undefined), 4000)
  // It routes to its own ops queue collection.
  assert.equal(salesFulfillmentTarget({ orderId: 'o1', intakeKind: 'social_promotion' }).collection, 'social_promotions')
})

test('resolveSalesProductRequest accepts the new product id', () => {
  const p = resolveSalesProductRequest({ productId: 'ad_social_promotion' })
  assert.equal(p?.id, 'ad_social_promotion')
})

test('custom product still requires a valid custom amount', () => {
  const custom = getSalesProduct('custom_one_time')!
  assert.equal(salesProductAmount(custom, 50), 5000)
  assert.equal(salesProductAmount(custom, 0), null)
  assert.equal(salesProductAmount(custom, 'abc'), null)
})
