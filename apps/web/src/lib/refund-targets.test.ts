import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selfServeRefundTargets } from './refund-targets'

// The failure this pins: a customer is refunded, the money goes back, and the
// thing they paid for stays live on the public site. A wrong collection name here
// is silent — the patch writes to a document nobody reads and everything looks
// like it worked.

test('a refunded job points at the jobs document the checkout provisioned', () => {
  assert.deepEqual(selfServeRefundTargets({ ad_type: 'job', product_id: 'job_123' }), [
    { collection: 'jobs', id: 'job_123' },
  ])
})

test('an ad campaign resolves to `campaigns`, which is where checkout wrote it', () => {
  // NOT 'ad_campaigns'. The provisioning branch writes to `campaigns`; patching
  // the other collection would revoke nothing while appearing to succeed.
  assert.deepEqual(selfServeRefundTargets({ ad_type: 'ad_campaign', product_id: 'camp_9' }), [
    { collection: 'campaigns', id: 'camp_9' },
  ])
})

test('a featured event points at the event, by its own id', () => {
  // event_feature carries event_id, not product_id — the paid placement lives on
  // the event document itself.
  assert.deepEqual(selfServeRefundTargets({ ad_type: 'event_feature', event_id: 'evt_5' }), [
    { collection: 'events', id: 'evt_5' },
  ])
})

test('the generic advertiser branch is reachable through campaign_id', () => {
  assert.deepEqual(selfServeRefundTargets({ campaign_id: 'camp_generic' }), [
    { collection: 'campaigns', id: 'camp_generic' },
  ])
})

test('rows belonging to a sales order produce NO targets', () => {
  // Cart and Sales-Desk rows carry sales_order_id and are revoked by the orders
  // loop instead. Returning a target here would double-handle them.
  assert.deepEqual(selfServeRefundTargets({ sales_order_id: 'ord_1', ad_type: 'sponsored_story' }), [])
  assert.deepEqual(selfServeRefundTargets({ sales_order_id: 'ord_2' }), [])
})

test('a row with nothing usable produces nothing, rather than a malformed path', () => {
  // A target with an empty id would address the COLLECTION, not a document.
  for (const row of [
    {},
    { ad_type: 'job' },
    { ad_type: 'job', product_id: '' },
    { ad_type: 'ad_campaign', product_id: null },
    { ad_type: 'event_feature' },
    { ad_type: 'event_feature', event_id: '' },
    { campaign_id: '' },
    { product_id: 'x', ad_type: 'something_else' },
  ]) {
    const targets = selfServeRefundTargets(row as any)
    assert.deepEqual(targets, [], `${JSON.stringify(row)} must produce no target`)
  }
})

test('every produced target has a non-empty collection and id', () => {
  // The invariant the caller depends on: it does adminDb.collection(c).doc(id),
  // and an empty id there is a runtime error at best.
  const rows = [
    { ad_type: 'job', product_id: 'j' },
    { ad_type: 'ad_campaign', product_id: 'c' },
    { ad_type: 'event_feature', event_id: 'e' },
    { campaign_id: 'g' },
    { ad_type: 'job', product_id: 'j', campaign_id: 'g' },
  ]
  for (const row of rows) {
    for (const t of selfServeRefundTargets(row as any)) {
      assert.ok(t.collection.length > 0, 'collection must not be empty')
      assert.ok(t.id.length > 0, 'id must not be empty')
    }
  }
})

test('a row carrying both a product and a campaign revokes both', () => {
  const targets = selfServeRefundTargets({ ad_type: 'job', product_id: 'j1', campaign_id: 'c1' })
  assert.deepEqual(targets, [
    { collection: 'jobs', id: 'j1' },
    { collection: 'campaigns', id: 'c1' },
  ])
})
