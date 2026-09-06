import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, invalidateRevocationCache } from '@citybeat/lib/firebase/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { revokeUserPatch } from '@citybeat/lib/auth/revocation'
import { validatePassword, isPasswordBreached, checkRateLimit, getClientIp } from '@/lib/auth-security'
import { fetchWithTimeout, FETCH_TIMEOUT_FAST } from '@/lib/http'

export const dynamic = 'force-dynamic'

// Changing the password of a signed-in account.
//
// This used to take a session and a new password and nothing else, which meant a
// stolen `__session` cookie was a permanent account takeover: the thief could set
// a new password without knowing the old one, and the real owner — now unable to
// sign in — had no way to evict them. Neither did the change invalidate anything,
// so every existing session stayed live afterwards. Changing your password is the
// single most common response to "I think someone got into my account", and it
// did not actually lock anyone out.
//
// Two controls, both standard and both previously absent:
//   1. Re-authenticate. Proving knowledge of the CURRENT password is what makes
//      this a decision by the account owner rather than by whoever holds a cookie.
//   2. Revoke every session, including this one, once it succeeds.
//
// This is not the forgotten-password path: recovery goes through Firebase's own
// hosted reset action with an oobCode, which never reaches this route (nothing
// here reads one). So requiring the current password cannot lock anyone out.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verifying the current password makes this a password oracle, so rate-limit
  // it per account, not just per IP.
  const rl = await checkRateLimit(`pwchange:${user.id}`, { max: 5, windowMs: 15 * 60 * 1000 })
  const rlIp = await checkRateLimit(`pwchange:ip:${getClientIp(request)}`, { max: 10, windowMs: 15 * 60 * 1000 })
  if (!rl.ok || !rlIp.ok) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''

  if (!currentPassword) {
    return NextResponse.json({ error: 'Your current password is required.' }, { status: 400 })
  }

  const pwCheck = validatePassword(password)
  if (!pwCheck.ok) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 })
  }
  if (await isPasswordBreached(password)) {
    return NextResponse.json(
      { error: 'This password has appeared in a known data breach. Please choose a different one.' },
      { status: 400 }
    )
  }

  // Re-authenticate against Firebase with the CURRENT password. Same Identity
  // Toolkit call the login route makes, so the answer is authoritative rather
  // than something we decide locally.
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey || !user.email) {
    return NextResponse.json({ error: 'Password change is unavailable right now.' }, { status: 503 })
  }
  try {
    const verify = await fetchWithTimeout(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: currentPassword, returnSecureToken: false }),
      },
      FETCH_TIMEOUT_FAST
    )
    if (!verify.ok) {
      return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not verify your current password. Please try again.' }, { status: 503 })
  }

  try {
    await adminAuth.updateUser(user.id, { password })

    // Everything signed in before this moment is now dead — that is the whole
    // point of changing a password. Firebase's own refresh tokens go too, so a
    // client holding one cannot mint a fresh session cookie afterwards.
    const now = new Date()
    await adminDb.collection('security').doc('revocations').set(revokeUserPatch(user.id, now), { merge: true })
    await adminAuth.revokeRefreshTokens(user.id).catch(() => {})
    invalidateRevocationCache()

    const response = NextResponse.json({ ok: true, signedOutEverywhere: true })
    response.cookies.set('__session', '', { maxAge: 0, path: '/' })
    return response
  } catch (error: any) {
    console.error('Update password error:', error)
    return NextResponse.json({ error: error?.message || 'Could not update password' }, { status: 500 })
  }
}
