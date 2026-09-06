import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile, invalidateRevocationCache } from '@citybeat/lib/firebase/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { revokeAllPatch, revokeUserPatch } from '@citybeat/lib/auth/revocation'
import { reportFailure } from '@/lib/alerts'
import { privilegedDenial } from '@/lib/privileged-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// The global kill now walks the whole user list to revoke refresh tokens, so it
// is no longer a sub-second request.
export const maxDuration = 300

// Firebase has no "revoke every refresh token" primitive, so the global kill has
// to walk the user list. This is deliberately the SECOND half of the switch: the
// Firestore cutoff is what actually ends live sessions and is written before this
// runs, so an abort here still signs everyone out.
//
// Bounded and best-effort, and it reports what it actually managed — an operator
// running this during a breach must never be told "done" when it was not.
const REVOKE_ALL_BUDGET_MS = 120_000
const REVOKE_ALL_CONCURRENCY = 25

async function revokeEveryRefreshToken(): Promise<{
  revoked: number
  failed: number
  truncated: boolean
}> {
  const startedAt = Date.now()
  let pageToken: string | undefined
  let revoked = 0
  let failed = 0

  do {
    let page: Awaited<ReturnType<typeof adminAuth.listUsers>>
    try {
      page = await adminAuth.listUsers(1000, pageToken)
    } catch {
      // Could not even enumerate: say so rather than implying full coverage.
      return { revoked, failed, truncated: true }
    }
    for (let i = 0; i < page.users.length; i += REVOKE_ALL_CONCURRENCY) {
      const results = await Promise.all(
        page.users
          .slice(i, i + REVOKE_ALL_CONCURRENCY)
          // Revoking twice is a no-op, so a retried or replayed kill lands on the
          // same state.
          .map((u) => adminAuth.revokeRefreshTokens(u.uid).then(() => true, () => false))
      )
      for (const ok of results) {
        if (ok) revoked++
        else failed++
      }
    }
    pageToken = page.pageToken
    if (pageToken && Date.now() - startedAt > REVOKE_ALL_BUDGET_MS) {
      return { revoked, failed, truncated: true }
    }
  } while (pageToken)

  return { revoked, failed, truncated: false }
}

// Kill switch for sessions. Until this existed there was none: a session cookie
// stayed valid for its full five days no matter what, so a stolen laptop, a
// compromised admin account, or a rep who had just been let go all meant waiting
// out the clock while they kept full access to payments, commissions and claims.
//
// Two levers:
//   { userId }  — end that person's sessions
//   { all: true } — end everyone's, including the caller's
//
// Both also revoke Firebase refresh tokens, so a client holding one cannot mint
// fresh Firebase credentials afterwards. `auth_time` survives a token refresh,
// which is what makes the Firestore cutoff hold even for a client that keeps
// refreshing.
//
// The { all } lever used to skip that half entirely — it wrote the Firestore
// cutoff and nothing else — so the endpoint's own contract was false for the one
// lever an operator reaches for in a breach. The cutoff only ends CityBeat
// sessions; a refresh token is a separate standing credential that keeps minting
// fresh Firebase ID tokens for whoever holds it, without ever re-entering a
// password. "Sign everyone out" left every one of those alive.
//
// For { all } the revocation is a bounded walk over every user (Firebase has no
// bulk primitive), so it is not unconditionally exhaustive: the response carries
// `refresh_tokens_complete`, and anything short of complete pages ops instead of
// returning a green success that hides it.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  // Signing out the entire platform is not something a password-only session
  // gets to do.
  const denial = privilegedDenial(profile, hasDeveloperAccess(profile))
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status })

  const body = await request.json().catch(() => ({}))
  const all = body?.all === true
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
  if (!all && !userId) {
    return NextResponse.json({ error: 'Provide a userId, or all: true.' }, { status: 400 })
  }

  const now = new Date()
  const ref = adminDb.collection('security').doc('revocations')

  let refreshTokens: { revoked: number; failed: number; truncated: boolean } | null = null

  try {
    if (all) {
      // Cutoff first: it takes effect immediately and does not depend on the walk
      // below finishing.
      await ref.set(revokeAllPatch(now), { merge: true })
      // Drop the cache before the walk, not after: the walk can run for minutes
      // and every second of it is a second this instance would otherwise keep
      // honouring sessions the operator has already killed.
      invalidateRevocationCache()
      refreshTokens = await revokeEveryRefreshToken()
    } else {
      await ref.set(revokeUserPatch(userId, now), { merge: true })
      // Best-effort: the Firestore cutoff is what actually enforces this, so a
      // Firebase Auth hiccup must not leave the caller believing nothing happened.
      await adminAuth.revokeRefreshTokens(userId).catch(() => {})
      invalidateRevocationCache()
    }

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
        // How much of the global kill actually landed, for the incident write-up.
        refresh_tokens: refreshTokens,
        created_at: now.toISOString(),
      })
      .catch(() => {})

    // A truncated or partially-failed walk means some clients still hold a live
    // refresh token. Page ops rather than let a green response hide it.
    if (refreshTokens && (refreshTokens.truncated || refreshTokens.failed > 0)) {
      await reportFailure(
        'session-revocation',
        new Error(
          `Global sign-out did not revoke every refresh token (revoked=${refreshTokens.revoked}, failed=${refreshTokens.failed}, truncated=${refreshTokens.truncated}). Re-run POST /api/admin/security/revoke {all:true}.`
        ),
        { all: true }
      ).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      revoked: all ? 'all' : userId,
      at: now.toISOString(),
      // Other instances still hold a cached copy for a few seconds.
      effective_within_seconds: 15,
      // Null for a single-user revoke (that one call either worked or was a
      // no-op). For { all } this is the honest count: re-run if not complete.
      refresh_tokens: refreshTokens,
      refresh_tokens_complete: refreshTokens
        ? !refreshTokens.truncated && refreshTokens.failed === 0
        : null,
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
  // Same gate as the POST: who is currently locked out is itself security state.
  const denial = privilegedDenial(profile, hasDeveloperAccess(profile))
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status })

  const doc = await adminDb.collection('security').doc('revocations').get().catch(() => null)
  const data = (doc?.exists ? doc.data() : {}) as any
  return NextResponse.json({
    all: data?.all || null,
    users: data?.users || {},
  })
}
