import { NextResponse } from 'next/server'
import { getServerUser, invalidateRevocationCache } from '@citybeat/lib/firebase/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { revokeUserPatch } from '@citybeat/lib/auth/revocation'

export const dynamic = 'force-dynamic'

// "Sign out everywhere" for your own account. A person who thinks they left a
// session open on a shared machine, or who has just changed their password,
// previously had no way to end it: the session cookie ran its full five days.
// This needs no elevated role — it can only ever affect the caller.
export async function POST() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  try {
    await adminDb.collection('security').doc('revocations').set(revokeUserPatch(user.id, now), { merge: true })
    await adminAuth.revokeRefreshTokens(user.id).catch(() => {})
    invalidateRevocationCache()
  } catch {
    return NextResponse.json({ error: 'Could not sign out your other sessions.' }, { status: 500 })
  }

  // This session is signed out too — that is the point, and it is also what the
  // person expects to see. Clearing the cookie here means the browser they are
  // holding does not sit on a session the server has already stopped honouring.
  const response = NextResponse.json({ success: true, at: now.toISOString() })
  response.cookies.set('__session', '', { maxAge: 0, path: '/' })
  return response
}
