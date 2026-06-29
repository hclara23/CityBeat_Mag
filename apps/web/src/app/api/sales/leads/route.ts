import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/supabase/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Unclaimed businesses for a rep to work (the field-sales pipeline). Optional
// ?city= filters by a substring of the address (light territory support).
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const city = (new URL(request.url).searchParams.get('city') || '').trim().toLowerCase()

  try {
    const snap = await adminDb
      .collection('directory_listings')
      .where('claim_status', '==', 'unclaimed')
      .limit(400)
      .get()

    let leads = snap.docs.map((d) => {
      const x = d.data() as any
      return {
        id: d.id,
        name: x.name || 'Business',
        category: x.category || null,
        address: x.address || null,
        phone: x.phone || null,
        email: x.email || x.contact_email || null,
      }
    })
    if (city) leads = leads.filter((l) => (l.address || '').toLowerCase().includes(city))
    // Prioritize leads we can actually reach (have phone/email).
    leads.sort((a, b) => Number(Boolean(b.email || b.phone)) - Number(Boolean(a.email || a.phone)))

    return NextResponse.json({ leads: leads.slice(0, 60), total: leads.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load leads' }, { status: 500 })
  }
}
