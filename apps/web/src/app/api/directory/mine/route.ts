import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
}

// Returns the directory listings the signed-in user owns, so they can boost
// (upgrade the tier of) their own business from the dashboard.
export async function GET() {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const snap = await adminDb
      .collection('directory_listings')
      .where('owner_id', '==', user.id)
      .get()

    const listings = snap.docs
      .map((d) => {
        const x = d.data() as any
        return {
          id: d.id,
          name: x.name || 'Untitled listing',
          tier: x.tier || 'basic',
          pending_tier: x.pending_tier || null,
          claim_status: x.claim_status || 'unclaimed',
          plan: x.plan || null,
          category: x.category || null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ listings })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load listings' }, { status: 500 })
  }
}
