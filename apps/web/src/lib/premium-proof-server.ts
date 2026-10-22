import { unstable_cache } from 'next/cache'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { daysAgoKey, statsDocId } from './listing-analytics'
import { pickRepresentativeProof, type PremiumProof, type ProofCandidate } from './premium-proof'

// Reads the real 30-day numbers behind the /premium results panel.
//
// COST IS THE DESIGN CONSTRAINT HERE. Firestore reads are this project's only
// variable cost, /premium is a public marketing page, and an uncached scan on a
// page anyone can refresh is how a directory with 8,000 listings turns a landing
// page into a bill. So:
//
//   - The candidate set is capped (SAMPLE_LISTINGS), not "all paid listings".
//   - Stats are fetched by CONSTRUCTED document id via getAll, never by a range
//     query over listing_stats — that collection has one doc per listing per
//     day, so an unbounded scan is six figures of reads.
//   - The whole thing sits behind unstable_cache for a day, so the cost is paid
//     once per day across all traffic rather than once per visitor.
//
// Worst case per day: SAMPLE_LISTINGS + (SAMPLE_LISTINGS x WINDOW_DAYS) reads,
// currently 12 + 360 = 372, against a 50,000/day free allowance.
//
// It also fails SILENTLY to null. A marketing panel is not worth a 500 on the
// page that sells the product, and the page is written to render nothing when
// there is no proof — which is also the honest behaviour when the data is thin.

const SAMPLE_LISTINGS = 12
const WINDOW_DAYS = 30

/** A day of Firestore caching. The underlying numbers move slowly and nobody is
 *  served by recomputing a 30-day aggregate per page view. */
const CACHE_SECONDS = 86_400

async function loadProof(): Promise<PremiumProof | null> {
  try {
    // Paid listings only. A free Basic listing's numbers are not evidence for
    // what Premium does, which is the entire claim the panel supports.
    const listingSnap = await adminDb
      .collection('directory_listings')
      .where('tier', 'in', ['premium', 'featured'])
      .limit(SAMPLE_LISTINGS)
      // Ids are all that is needed; this still bills a read per document but
      // avoids pulling whole listing bodies across the wire.
      .select()
      .get()

    const listingIds = listingSnap.docs.map((doc) => doc.id)
    if (listingIds.length === 0) return null

    const now = new Date()
    const days = Array.from({ length: WINDOW_DAYS }, (_, offset) => daysAgoKey(now, offset))

    const refs = listingIds.flatMap((listingId) =>
      days.map((day) => adminDb.collection('listing_stats').doc(statsDocId(listingId, day)))
    )

    // Chunked to match the batching limit the directory ingest already uses.
    const totals = new Map<string, ProofCandidate>()
    for (const listingId of listingIds) {
      totals.set(listingId, {
        listingId,
        view: 0,
        click_website: 0,
        click_directions: 0,
        click_phone: 0,
        click_action: 0,
        lead: 0,
      })
    }

    for (let index = 0; index < refs.length; index += 300) {
      const chunk = refs.slice(index, index + 300)
      const snaps = await adminDb.getAll(...chunk)
      for (const snap of snaps) {
        if (!snap.exists) continue
        // The doc id is `${listingId}_${YYYY-MM-DD}`; the date is fixed width, so
        // stripping the final 11 characters recovers the listing id even when the
        // listing id itself contains underscores.
        const listingId = snap.id.slice(0, -11)
        const candidate = totals.get(listingId)
        if (!candidate) continue
        const data = snap.data() as Record<string, unknown>
        candidate.view += Number(data.view) || 0
        candidate.click_website += Number(data.click_website) || 0
        candidate.click_directions += Number(data.click_directions) || 0
        candidate.click_phone += Number(data.click_phone) || 0
        candidate.click_action += Number(data.click_action) || 0
        candidate.lead += Number(data.lead) || 0
      }
    }

    return pickRepresentativeProof([...totals.values()], WINDOW_DAYS)
  } catch {
    // Deliberately swallowed: the page renders without the panel. A marketing
    // illustration must never be able to take down the page that sells the plan.
    return null
  }
}

export const getPremiumProof = unstable_cache(loadProof, ['premium-proof-v1'], {
  revalidate: CACHE_SECONDS,
  tags: ['premium-proof'],
})
