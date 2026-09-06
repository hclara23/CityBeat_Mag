import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'

export const dynamic = 'force-dynamic'

// POST /api/admin/directory/publish-all - publish every hidden directory listing
export async function POST() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  // Role AND second factor, together. This checked the role alone, so a staff
  // password with no TOTP enrollment behind it reached this API even though the
  // page in front of it only redirects. See lib/privileged-access.
  const denial = privilegedDenial(profile, hasAdminAccess(profile))
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status })

  try {
    const snap = await adminDb.collection('directory_listings').where('is_published', '==', false).get()
    if (snap.empty) return NextResponse.json({ published: 0 })

    const now = new Date().toISOString()
    let batch = adminDb.batch()
    let count = 0
    let inBatch = 0
    for (const doc of snap.docs) {
      batch.set(doc.ref, { is_published: true, updated_at: now }, { merge: true })
      count++
      inBatch++
      if (inBatch === 450) {
        await batch.commit()
        batch = adminDb.batch()
        inBatch = 0
      }
    }
    if (inBatch > 0) await batch.commit()

    return NextResponse.json({ published: count })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}
