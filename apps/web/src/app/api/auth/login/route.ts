import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit, clearRateLimit } from '@/lib/auth-security'

export const dynamic = 'force-dynamic'

// "Keep me signed in" → a 14-day persistent cookie (14d is Firebase's max session
// cookie lifetime). Opt out → a 12-hour browser-session cookie that's cleared when
// the browser closes.
const REMEMBER_MS = 60 * 60 * 24 * 14 * 1000 // 14 days
const SESSION_ONLY_MS = 60 * 60 * 12 * 1000 // 12 hours
const MFA_PENDING_MS = 5 * 60 * 1000 // 5 min to complete the 2FA step

function getPrimaryPlatformRole(profile: any) {
  if (profile?.is_developer) return 'developer'
  if (profile?.is_editor) return 'editor'
  if (profile?.is_sales) return 'sales'
  if (profile?.is_writer) return 'writer'
  if (profile?.is_advertiser) return 'advertiser'
  return 'reader'
}

function profilePayload(profile: any) {
  return {
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
  }
}

function setSessionCookie(response: NextResponse, sessionCookie: string, remember: boolean) {
  // Cookie name MUST be `__session`: Firebase Hosting (Fastly) strips all other
  // cookies before forwarding to Cloud Run.
  response.cookies.set('__session', sessionCookie, {
    // Omit maxAge when not remembering → a session cookie that dies on browser close.
    ...(remember ? { maxAge: REMEMBER_MS / 1000 } : {}),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  })
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  // Default to "remember" so a blank/old client still gets a persistent session.
  const remember = (body as any).rememberMe !== false

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // Rate limit by IP and by email to blunt brute force / credential stuffing.
  const ip = getClientIp(request)
  for (const key of [`login:ip:${ip}`, `login:email:${email}`]) {
    const rl = await checkRateLimit(key, { max: 8, windowMs: 15 * 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 900) } }
      )
    }
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // 1. Verify credentials via Firebase REST.
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    )
    const signInData = await signInRes.json()

    if (!signInRes.ok) {
      // Generic message — never reveal whether the email exists (no enumeration).
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const idToken = signInData.idToken
    const uid = signInData.localId

    // 2. Enforce verified email (prevents impersonation / unverified signups).
    const userRecord = await adminAuth.getUser(uid)
    if (!userRecord.emailVerified) {
      return NextResponse.json(
        {
          error: 'Please verify your email before signing in. Check your inbox for the verification link.',
          email_unverified: true,
        },
        { status: 403 }
      )
    }

    const profileDoc = await adminDb.collection('profiles').doc(uid).get()
    const profile = profileDoc.exists ? profileDoc.data() : null

    // 3. If 2FA is enabled, do NOT issue a session yet — require the TOTP step.
    if (profile?.mfa_enabled) {
      const mfaToken = randomBytes(32).toString('hex')
      await adminDb.collection('mfa_pending').doc(mfaToken).set({
        uid,
        id_token: idToken,
        remember,
        attempts: 0,
        expires_at: Date.now() + MFA_PENDING_MS,
        created_at: FieldValue.serverTimestamp(),
      })
      return NextResponse.json({ mfa_required: true, mfa_token: mfaToken })
    }

    // 4. No 2FA — issue the session cookie now.
    const expiresIn = remember ? REMEMBER_MS : SESSION_ONLY_MS
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })
    await clearRateLimit(`login:email:${email}`)
    await clearRateLimit(`login:ip:${ip}`)

    const response = NextResponse.json({ ok: true, profile: profilePayload(profile) })
    setSessionCookie(response, sessionCookie, remember)
    return response
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
