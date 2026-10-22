import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { dayKey, statsDocId } from './listing-analytics'
import { listingEventCounters, type ClientListingEvent } from './listing-tracking'

export async function recordListingAction(db: Pick<Firestore, 'collection'>, listingId: string, type: ClientListingEvent, now = new Date()) {
  const day = dayKey(now)
  await db.collection('listing_stats').doc(statsDocId(listingId, day)).set({
    listing_id: listingId, day, updated_at: now.toISOString(),
    ...Object.fromEntries(listingEventCounters(type).map(key => [key, FieldValue.increment(1)])),
  }, { merge: true })
}

// Persist the genuine lead and its counter together. A detached increment can
// disappear when Cloud Run freezes after the response, or silently fail alone.
export async function recordQuoteWithStats(
  db: Pick<Firestore, 'collection' | 'batch'>,
  listingId: string,
  data: Record<string, unknown>,
  countLead: boolean,
  now = new Date(),
) {
  const quote = db.collection('quote_requests').doc()
  const batch = db.batch()
  batch.set(quote, data)
  if (countLead) {
    const day = dayKey(now)
    batch.set(db.collection('listing_stats').doc(statsDocId(listingId, day)), {
      listing_id: listingId, day, lead: FieldValue.increment(1), updated_at: now.toISOString(),
    }, { merge: true })
  }
  await batch.commit()
  return quote.id
}
