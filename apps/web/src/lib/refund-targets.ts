// Which product document a SELF-SERVE checkout provisioned.
//
// The refund path could only revoke things reachable via a sales_orders row, and
// a self-serve checkout has none — so a refunded or charged-back $50 job posting
// stayed published on the public board for its full 30 days. The answer is read
// back off the `ad_purchases` ledger row that checkout wrote.
//
// Extracted from the webhook so it can be tested: it is a pure mapping, and the
// consequence of getting a collection name wrong is that a refunded product stays
// live, which is exactly the kind of thing a test should catch rather than a
// customer.

export type RefundTarget = { collection: string; id: string }

export function selfServeRefundTargets(purchase: Record<string, any>): RefundTarget[] {
  const targets: RefundTarget[] = []
  // `product_id` + `ad_type` are what the job/ad-campaign provisioning branch of
  // checkout.session.completed writes; the collections must match the ones it
  // provisioned into ('campaigns', NOT 'ad_campaigns').
  const productId = typeof purchase.product_id === 'string' ? purchase.product_id : ''
  if (productId && purchase.ad_type === 'job') targets.push({ collection: 'jobs', id: productId })
  if (productId && purchase.ad_type === 'ad_campaign') targets.push({ collection: 'campaigns', id: productId })
  if (purchase.ad_type === 'event_feature' && typeof purchase.event_id === 'string' && purchase.event_id) {
    targets.push({ collection: 'events', id: purchase.event_id })
  }
  // The generic advertiser branch flips campaigns/<campaignId> to active.
  if (typeof purchase.campaign_id === 'string' && purchase.campaign_id) {
    targets.push({ collection: 'campaigns', id: purchase.campaign_id })
  }
  return targets
}
