import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toMs(v: any): number {
  if (!v) return 0
  if (v?._seconds) return v._seconds * 1000
  if (typeof v === 'string') return Date.parse(v) || 0
  return 0
}

// Admin inbox of captured "request a quote" leads (quote_requests).
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const snap = await adminDb.collection('quote_requests').get()
    const leads = snap.docs
      .map((d) => {
        const x = d.data() as any
        return {
          id: d.id,
          business_name: x.business_name || null,
          listing_id: x.listing_id || null,
          name: x.name || '',
          contact: x.contact || '',
          message: x.message || null,
          status: x.status || 'new',
          created_at: toMs(x.created_at),
        }
      })
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 200)
    return NextResponse.json({ leads })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load leads' }, { status: 500 })
  }
}
