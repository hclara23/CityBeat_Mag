import { adminDb } from '@citybeat/lib/firebase/admin'
import { buildSalesFulfillmentRecord, salesFulfillmentTarget } from './sales-fulfillment'

export async function provisionSalesOrder(input: {
  orderId: string
  order: Record<string, any>
  values: Record<string, unknown>
}) {
  if (input.order.payment_status !== 'paid') throw new Error('Order must be paid before fulfillment.')
  const target = salesFulfillmentTarget({
    orderId: input.orderId,
    intakeKind: input.order.intake_kind,
    listingId: input.order.listing_id,
  })
  const record = buildSalesFulfillmentRecord(input)
  // Deterministic target ids make submission retries idempotent.
  const targetRef = adminDb.collection(target.collection).doc(target.id)
  if (target.collection === 'directory_listings') {
    const existing = await targetRef.get()
    if (!existing.exists) {
      Object.assign(record, {
        claim_status: 'unclaimed',
        ownership_verified: false,
        is_published: true,
        // Only a genuinely new doc gets a creation date — a re-submitted brief
        // must not reset the age of an existing listing.
        created_at: new Date().toISOString(),
      })
    }
  }
  await targetRef.set(record, { merge: true })
  return target
}
