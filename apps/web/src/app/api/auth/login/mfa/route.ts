import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { verifyTotp } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// Mirrors the durations in ../route.ts: "keep me signed in" → 14-day persistent
// cookie (Firebase's max); opt out → 12-hour browser-session cookie.
const REMEMBER_MS = 60 * 60 * 24 * 14 * 1000
const SESSION_ONLY_MS = 60 * 60 * 12 * 1000
const MAX_MFA_ATTEMPTS = 5

function getPrimaryPlatformRole(profile: any) {
  if (profile?.is_developer) return 'developer'
  if (profile?.is_editor) return 'editor'
  if (profile?.is_sales) return 'sales'
  if (profile?.is_writer) return 'writer'
  if (profile?.is_advertiser) return 'advertiser'
  return 'reader'
}

// Completes a login that requires 2FA: validates the short-lived pending token +
// the TOTP code, then issues the session cookie. Single-use.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const mfaToken = typeof body.mfa_token === 'string' ? body.mfa_token : ''
  const code = typeof body.code === 'string' ? body.code : ''
  if (!mfaToken || !code) {
    return NextResponse.json({ error: 'Missing verification code' }, { status: 400 })
  }

  const ref = adminDb.collection('mfa_pending').doc(mfaToken)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: 'Your sign-in session expired. Please log in again.' }, { status: 401 })
  }
  const pending = snap.data() as any

  if (typeof pending.expires_at !== 'number' || pending.expires_at <= Date.now()) {
    await ref.delete().catch(() => {})
    return NextResponse.json({ error: 'Your sign-in session expired. Please log in again.' }, { status: 401 })
  }

  if ((pending.attempts || 0) >= MAX_MFA_ATTEMPTS) {
    await ref.delete().catch(() => {})
    return NextResponse.json({ error: 'Too many incorrect codes. Please log in again.' }, { status: 429 })
  }

  const mfaDoc = await adminDb.collection('user_mfa').doc(pending.uid).get()
  const secret = mfaDoc.exists ? (mfaDoc.data() as any).secret : null

  if (!secret || !verifyTotp(secret, code)) {
    await ref.set({ attempts: (pending.attempts || 0) + 1 }, { merge: true })
    return NextResponse.json({ error: 'Invalid verification code.' }, { status: 401 })
  }

  // Code is valid — mint the session from the stored id token, then burn the token.
  // Honor the "keep me signed in" choice captured at the password step.
  const remember = pending.remember !== false
  try {
    const expiresIn = remember ? REMEMBER_MS : SESSION_ONLY_MS
    const sessionCookie = await adminAuth.createSessionCookie(pending.id_token, { expiresIn })
    await ref.delete().catch(() => {})

    const profileDoc = await adminDb.collection('profiles').doc(pending.uid).get()
    const profile = profileDoc.exists ? profileDoc.data() : null

    const response = NextResponse.json({
      ok: true,
      profile: {
        primary_role: getPrimaryPlatformRole(profile),
        is_developer: profile?.is_developer ?? false,
        is_editor: profile?.is_editor ?? false,
        is_writer: profile?.is_writer ?? false,
        is_sales: profile?.is_sales ?? false,
        is_advertiser: profile?.is_advertiser ?? false,
        can_manage_platform: Boolean(profile?.is_developer),
        sales_dashboard_enabled: Boolean(
          profile?.sales_dashboard_enabled || profile?.is_developer || profile?.is_sales
        ),
      },
    })
    response.cookies.set('__session', sessionCookie, {
      // Omit maxAge when not remembering → session cookie cleared on browser close.
      ...(remember ? { maxAge: REMEMBER_MS / 1000 } : {}),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })
    return response
  } catch (e) {
    console.error('MFA session mint failed:', e)
    return NextResponse.json({ error: 'Could not complete sign-in. Please try again.' }, { status: 500 })
  }
}
