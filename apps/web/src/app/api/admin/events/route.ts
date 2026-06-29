import { NextResponse, NextRequest } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const eventsSnap = await adminDb.collection('events').orderBy('start_date', 'asc').get()
    const events = eventsSnap.docs.map((d) => ({ 
      id: d.id, 
      ...(d.data() as any), 
      created_at: toIso((d.data() as any).created_at) 
    }))

    return NextResponse.json({ events })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

// Moderate a community-submitted event: approve (publishes it) or reject.
export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const action = body.action === 'reject' ? 'rejected' : body.action === 'approve' ? 'approved' : ''
  if (!id || !action) return NextResponse.json({ error: 'id and action (approve|reject) required' }, { status: 400 })

  try {
    await adminDb.collection('events').doc(id).set(
      { status: action, moderated_by: user.id, moderated_at: new Date().toISOString() },
      { merge: true }
    )
    return NextResponse.json({ success: true, status: action })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Event ID required' }, { status: 400 })

  try {
    await adminDb.collection('events').doc(id).delete()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
