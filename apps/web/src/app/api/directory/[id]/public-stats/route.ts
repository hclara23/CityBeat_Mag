import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { daysAgoKey, statsDocId, type DailyStatRow } from '@/lib/listing-analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PUBLIC aggregate stats for an UNCLAIMED listing — powers the "¿Es su negocio?
// 142 personas vieron esta página este mes" claim banner. Deliberately tiny
// surface: total 30-day views + unanswered-question count, nothing else, and
// ONLY for unclaimed listings (a claimed business's analytics are the owner's,
// gated behind /api/directory/[id]/analytics). Cached 1h per listing so the
// banner doesn't multiply Firestore reads on every page view.
const getPublicStats = (id: string) =>
  unstable_cache(
    async () => {
      const now = new Date()
      const refs = Array.from({ length: 30 }, (_, i) =>
        adminDb.collection('listing_stats').doc(statsDocId(id, daysAgoKey(now, 29 - i)))
      )
      const [statDocs, questionsSnap] = await Promise.all([
        adminDb.getAll(...refs),
        adminDb
          .collection('listing_questions')
          .where('listing_id', '==', id)
          .limit(50)
          .get()
          .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
      ])

      let views = 0
      for (const d of statDocs) {
        if (!d.exists) continue
        views += Number((d.data() as DailyStatRow).view) || 0
      }
      const unanswered = questionsSnap.docs.filter((q) => !(q.data() as any).answer).length

      return { views_30d: views, unanswered_questions: unanswered, eligible: true }
    },
    ['listing-public-stats', id],
    { revalidate: 3600 }
  )()

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[A-Za-z0-9:_-]{1,120}$/.test(id)) {
    return NextResponse.json({ views_30d: 0, unanswered_questions: 0, eligible: false })
  }
  try {
    // Eligibility on the LIVE doc (one cheap read, never cached): the moment a
    // business claims, its stats stop being public — only the expensive stat
    // aggregation behind it is cached.
    const listingSnap = await adminDb.collection('directory_listings').doc(id).get()
    const listing = listingSnap.exists ? (listingSnap.data() as any) : null
    if (!listing || listing.claim_status !== 'unclaimed' || listing.merged_into) {
      return NextResponse.json({ views_30d: 0, unanswered_questions: 0, eligible: false })
    }
    const stats = await getPublicStats(id)
    return NextResponse.json(stats)
  } catch {
    // The banner degrades to its number-free copy — never error the page.
    return NextResponse.json({ views_30d: 0, unanswered_questions: 0, eligible: false })
  }
}
