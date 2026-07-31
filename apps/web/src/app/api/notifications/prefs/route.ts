import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getNotifyPrefs, sanitizeNotifyPrefsPatch } from '@/lib/notify-prefs'

export const dynamic = 'force-dynamic'

// Owner notification preferences: activity emails + monthly reports default ON;
// SMS is an explicit opt-in. Stored on the user's own profile only.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  return NextResponse.json({ prefs: getNotifyPrefs(profile) })
}

export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const patch = sanitizeNotifyPrefsPatch(body)
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid preference changes' }, { status: 400 })
  }

  const profile = await getServerUserProfile(user.id)
  const next = { ...getNotifyPrefs(profile), ...patch }
  await adminDb
    .collection('profiles')
    .doc(user.id)
    .set({ notify_prefs: next, updated_at: new Date().toISOString() }, { merge: true })
  return NextResponse.json({ prefs: next })
}
