import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// First-party notification inbox — scoped strictly to the signed-in user's own
// subcollection, so there is no cross-user access path.
function itemsRef(userId: string) {
  return adminDb.collection('user_notifications').doc(userId).collection('items')
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const snap = await itemsRef(user.id).orderBy('created_at', 'desc').limit(30).get()
    const notifications = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    const unread = notifications.filter((n: any) => !n.read_at).length
    return NextResponse.json({ notifications, unread })
  } catch {
    return NextResponse.json({ notifications: [], unread: 0 })
  }
}

// POST { action: 'read', id } — mark one read; { action: 'read_all' } — all.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const now = new Date().toISOString()
  try {
    if (body.action === 'read' && typeof body.id === 'string' && body.id) {
      // update() never creates a doc — a bogus id is a harmless no-op, not a
      // phantom write.
      await itemsRef(user.id).doc(body.id).update({ read_at: now }).catch(() => {})
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'read_all') {
      const snap = await itemsRef(user.id).orderBy('created_at', 'desc').limit(100).get()
      const batch = adminDb.batch()
      snap.docs.forEach((d) => {
        if (!(d.data() as any).read_at) batch.update(d.ref, { read_at: now })
      })
      await batch.commit()
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 })
  }
}
