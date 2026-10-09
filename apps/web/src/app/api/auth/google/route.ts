import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { resolvePlatformCapabilities } from '@citybeat/lib/roles'
import { checkRateLimit, getClientIp } from '@/lib/auth-security'
import { googleProfileForSignIn, googleSessionOutcome, newGoogleProfile, trustedSignInOrigin, validGoogleIdentity } from '@/lib/google-signin-policy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!trustedSignInOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co')) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  }
  const limit = await checkRateLimit(`google-login:${getClientIp(request)}`, { max: 12, windowMs: 15 * 60 * 1000 })
  if (!limit.ok) return NextResponse.json({ error: 'Too many sign-in attempts. Try again later.' }, { status: 429 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.idToken !== 'string' || body.idToken.length > 20000) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const remember = body.rememberMe !== false
  try {
    const identity = await adminAuth.verifyIdToken(body.idToken, true)
    if (!validGoogleIdentity(identity, Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: 'Please sign in again with a verified Google account.' }, { status: 401 })
    }
    const record = await adminAuth.getUser(identity.uid)
    if (record.disabled || !record.emailVerified || !record.email) {
      return NextResponse.json({ error: 'Account unavailable' }, { status: 403 })
    }
    const profileRef = adminDb.collection('profiles').doc(record.uid)
    const profile = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(profileRef)
      // Never overwrite existing roles, MFA configuration, or preferences on sign-in.
      const fresh = { ...newGoogleProfile(record.uid, record.email!, record.displayName || '', body.locale),
        created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() }
      if (!snap.exists) tx.create(profileRef, fresh)
      return googleProfileForSignIn(snap.data(), fresh)
    })
    const expiresIn = (remember ? 14 * 24 : 12) * 60 * 60 * 1000
    const outcome = await googleSessionOutcome(profile, {
      createMfaChallenge: async () => {
      const token = randomBytes(32).toString('hex')
      await adminDb.collection('mfa_pending').doc(token).set({
        uid: record.uid, id_token: body.idToken, remember, attempts: 0,
        expires_at: Date.now() + 5 * 60 * 1000, created_at: FieldValue.serverTimestamp(),
      })
      return token
      },
      createCookie: () => adminAuth.createSessionCookie(body.idToken, { expiresIn }),
    })
    if (outcome.kind === 'mfa') return NextResponse.json({ mfa_required: true, mfa_token: outcome.token })
    const response = NextResponse.json({ ok: true, profile: resolvePlatformCapabilities(profile) })
    response.cookies.set('__session', outcome.cookie, {
      ...(remember ? { maxAge: expiresIn / 1000 } : {}), httpOnly: true,
      secure: process.env.NODE_ENV === 'production', path: '/', sameSite: 'lax',
    })
    return response
  } catch {
    // Tokens and upstream credential errors must never enter logs or responses.
    return NextResponse.json({ error: 'Google sign-in could not be completed. Please try again.' }, { status: 401 })
  }
}
