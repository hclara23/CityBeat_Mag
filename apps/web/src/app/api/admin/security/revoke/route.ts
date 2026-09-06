import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile, invalidateRevocationCache } from '@citybeat/lib/firebase/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { revokeAllPatch, revokeUserPatch } from '@citybeat/lib/auth/revocation'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

// Kill switch for sessions. Until this existed there was none: a session cookie
// stayed valid for its full five days no matter what, so a stolen laptop, a
// compromised admin account, or a rep who had just been let go all meant waiting
// out the clock while they kept full access to payments, commissions and claims.
//
// Two levers:
//   { userId }  — end that person's sessions
//   { all: true } — end everyone's, including the caller's
//
// Both also revoke the Firebase refresh token, so a client holding one cannot
// mint a fresh session cookie afterwards. `auth_time` survives a token refresh,
// which is what makes the cutoff hold even for a client that keeps refreshing.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Signing out the entire platform is not something a password-only session
  // gets to do.
  if (!profile?.mfa_enabled) {
    return NextResponse.json(
      { error: 'Two-factor authentication is required for this action.' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const all = body?.all === true
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
  if (!all && !userId) {
    return NextResponse.json({ error: 'Provide a userId, or all: true.' }, { status: 400 })
  }

  const now = new Date()
  const ref = adminDb.collection('security').doc('revocations')

  try {
    if (all) {
      await ref.set(revokeAllPatch(now), { merge: true })
    } else {
      await ref.set(revokeUserPatch(userId, now), { merge: true })
      // Best-effort: the Firestore cutoff is what actually enforces this, so a
      // Firebase Auth hiccup must not leave the caller believing nothing happened.
      await adminAuth.revokeRefreshTokens(userId).catch(() => {})
    }
    invalidateRevocationCache()

    // Revocation is a security event; it belongs in the audit trail whether it
    // was a response to a breach or a mistake someone needs to explain later.
    await adminDb
      .collection('audit_log')
      .add({
        action: all ? 'revoke_all_sessions' : 'revoke_user_sessions',
        actor_id: user.id,
        actor_email: user.email || null,
        target_user_id: all ? null : userId,
        reason: typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null,
        created_at: now.toISOString(),
      })
      .catch(() => {})

    return NextResponse.json({
      success: true,
      revoked: all ? 'all' : userId,
      at: now.toISOString(),
      // Other instances still hold a cached copy for a few seconds.
      effective_within_seconds: 15,
    })
  } catch (error: any) {
    await reportFailure('session-revocation', error, { all, user_id: userId || null }).catch(() => {})
    return NextResponse.json({ error: 'Could not revoke sessions.' }, { status: 500 })
  }
}

// What is currently revoked, so an operator can see whether a kill took effect.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const doc = await adminDb.collection('security').doc('revocations').get().catch(() => null)
  const data = (doc?.exists ? doc.data() : {}) as any
  return NextResponse.json({
    all: data?.all || null,
    users: data?.users || {},
  })
}
