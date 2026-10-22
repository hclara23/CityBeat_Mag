import { unstable_cache } from 'next/cache'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { statsDocId } from './listing-analytics'
import { type PremiumProof } from './premium-proof'
import { loadPremiumProof, PROOF_WINDOW_DAYS, type ProofStat } from './premium-proof-loader'
import { reportFailure } from './alerts'

// At most 100 candidate reads plus 12 x 30 daily stats reads per cached load.
// Filter actual subscription entitlements before taking the 12-listing sample.
// Cache for one day; read stats by constructed IDs, never scan listing_stats.
async function loadProof(): Promise<PremiumProof | null> {
  try {
    const result = await loadPremiumProof({
      listings: async (limit) => {
        const snap = await adminDb.collection('directory_listings')
          .where('tier', 'in', ['premium', 'featured'])
          .limit(limit)
          .select('tier', 'is_published', 'merged_into', 'stripe_subscription_id')
          .get()
        return snap.docs.map(doc => ({ ...doc.data(), listingId: doc.id }))
      },
      stats: async (ids, days) => {
        const refs = ids.flatMap(id => days.map(day =>
          adminDb.collection('listing_stats').doc(statsDocId(id, day))))
        const rows: ProofStat[] = []
        for (let index = 0; index < refs.length; index += 300) {
          const snaps = await adminDb.getAll(...refs.slice(index, index + 300))
          for (const snap of snaps) {
            if (snap.exists) rows.push({ listingId: snap.id.slice(0, -11), counts: snap.data()! })
          }
        }
        return rows
      },
    })
    // A successful read with thin evidence is not an automation failure. Keep
    // the business signal observable without sending a false failure email.
    console.info('[premium-proof]', JSON.stringify(result.diagnostics))
    return result.proof
  } catch (error) {
    // Actual read failures remain operational alerts; the page still fails soft.
    await reportFailure('premium-proof', error, { windowDays: PROOF_WINDOW_DAYS }, { skipHealth: true }).catch(() => {})
    return null
  }
}

export const getPremiumProof = unstable_cache(loadProof, ['premium-proof-v2'], {
  revalidate: 86_400,
  tags: ['premium-proof'],
})
