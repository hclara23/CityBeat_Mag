import { NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { buildLeaderboard } from '@/lib/points'

export const dynamic = 'force-dynamic'

// Public contributor leaderboard: top reviewers/photo contributors by points.
// Names only — no emails or uids leave the server. Advertisers and zero-point
// users are excluded in buildLeaderboard.
export async function GET() {
  try {
    // Only profiles that have earned points are candidates. review_points is
    // the running total maintained by the ledger-backed award path.
    const snap = await adminDb
      .collection('profiles')
      .where('review_points', '>', 0)
      .orderBy('review_points', 'desc')
      .limit(100)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))

    const users = snap.docs.map((d) => {
      const x = d.data() as any
      return {
        user_id: d.id,
        name: x.full_name || x.display_name || null,
        points: Number(x.review_points) || 0,
        is_advertiser: Boolean(x.is_advertiser),
      }
    })

    return NextResponse.json({ leaderboard: buildLeaderboard(users, 50) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load leaderboard' }, { status: 500 })
  }
}
