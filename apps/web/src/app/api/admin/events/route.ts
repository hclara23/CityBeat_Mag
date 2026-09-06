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

// Upcoming plus the last week. Past events are immutable history, not a queue.
const ADMIN_EVENT_LIMIT = 500

export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!profile?.mfa_enabled) {
    return NextResponse.json(
      { error: 'Two-factor authentication is required for this action. Enable it under Account → Security.' },
      { status: 403 }
    )
  }

  try {
    // Bounded by DEFAULT, not permanently. This read the ENTIRE events
    // collection, which grows every time the Ticketmaster sync runs and is never
    // pruned — so an admin page load allocated the whole history to show a
    // moderation queue, and Firestore bills per document read regardless of
    // projection, which is the only variable cost this app has.
    //
    // The default window is upcoming plus the last week, because that IS the
    // moderation queue: an event that started earlier today is still the thing
    // most likely to need attention. Older events are housekeeping, not review.
    //
    // `?all=1` returns the full history. Bounding a default is fine; silently
    // removing an operator's ability to reach a record is not, and the page has
    // no past/upcoming filter of its own to compensate.
    const wantAll = new URL(request.url).searchParams.get('all') === '1'
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    let query = adminDb.collection('events').orderBy('start_date', 'asc')
    if (!wantAll) {
      // Range filter and orderBy on the SAME field, so the automatic single-field
      // index serves this; no composite index has to exist first.
      query = query.where('start_date', '>=', since).orderBy('start_date', 'asc')
    }
    const eventsSnap = await query.limit(ADMIN_EVENT_LIMIT).get()
    const events = eventsSnap.docs.map((d) => ({ 
      id: d.id, 
      ...(d.data() as any), 
      created_at: toIso((d.data() as any).created_at) 
    }))

    return NextResponse.json({
      events,
      window: wantAll ? 'all' : `from ${since}`,
      truncated: eventsSnap.size >= ADMIN_EVENT_LIMIT,
    })
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
  if (!profile?.mfa_enabled) {
    return NextResponse.json(
      { error: 'Two-factor authentication is required for this action. Enable it under Account → Security.' },
      { status: 403 }
    )
  }

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
  if (!profile?.mfa_enabled) {
    return NextResponse.json(
      { error: 'Two-factor authentication is required for this action. Enable it under Account → Security.' },
      { status: 403 }
    )
  }

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
