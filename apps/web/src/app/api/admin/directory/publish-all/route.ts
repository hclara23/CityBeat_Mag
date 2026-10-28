import { NextResponse } from 'next/server'
import { bumpDirectoryIndexVersion } from '@/lib/directory-index-version'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { auditDirectoryPublication } from '@/lib/directory-publication'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  const denial = privilegedDenial(profile, hasAdminAccess(profile))
  if (denial) return denial
  return { user }
}

async function loadAudit() {
  const snap = await adminDb.collection('directory_listings').get()
  return auditDirectoryPublication(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
}

// GET is a non-mutating preview. Operators can see why records are held before
// deciding whether to publish the eligible subset.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    return NextResponse.json(await loadAudit())
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}

// POST publishes only audited eligible records, never every hidden document.
// A bounded batch keeps review and rollback practical as the directory grows.
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Explicit confirmation is required' }, { status: 400 })
    }
    const audit = await loadAudit()
    const eligibleIds = audit.eligibleIds.slice(0, 250)
    if (!eligibleIds.length) return NextResponse.json({ published: 0, remaining_eligible: 0, audit })

    const now = new Date().toISOString()
    let batch = adminDb.batch()
    let count = 0
    let inBatch = 0
    for (const id of eligibleIds) {
      batch.set(adminDb.collection('directory_listings').doc(id), {
        is_published: true,
        published_at: now,
        publication_method: 'validated_bulk',
        updated_at: now,
      }, { merge: true })
      count++
      inBatch++
      if (inBatch === 450) {
        await batch.commit()
        batch = adminDb.batch()
        inBatch = 0
      }
    }
    if (inBatch > 0) await batch.commit()
    await bumpDirectoryIndexVersion('publish-all')

    return NextResponse.json({
      published: count,
      remaining_eligible: Math.max(0, audit.eligible - count),
      audit,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}
