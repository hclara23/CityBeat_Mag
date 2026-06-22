import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function getPrimaryPlatformRole(profile: any) {
  if (profile?.is_developer) return 'developer'
  if (profile?.is_editor) return 'editor'
  if (profile?.is_sales) return 'sales'
  if (profile?.is_writer) return 'writer'
  if (profile?.is_advertiser) return 'advertiser'
  return 'reader'
}

function hasDeveloperAccess(profile: any) {
  return Boolean(profile?.is_developer)
}

function hasSalesAccess(profile: any) {
  return Boolean(profile?.sales_dashboard_enabled || profile?.is_developer || profile?.is_sales)
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Firebase API key is missing' }, { status: 500 })
  }

  try {
    // 1. Authenticate with Firebase via REST API
    const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })

    const signInData = await signInRes.json()

    if (!signInRes.ok) {
      return NextResponse.json({ error: signInData.error?.message || 'Authentication failed' }, { status: 401 })
    }

    const idToken = signInData.idToken

    // 2. Create a session cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000 // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })

    const uid = signInData.localId

    // 3. Fetch user profile from Firestore
    const profileDoc = await adminDb.collection('profiles').doc(uid).get()
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
        can_manage_platform: hasDeveloperAccess(profile),
        sales_dashboard_enabled: hasSalesAccess(profile),
      },
    })

    // Set cookie
    // Cookie name MUST be `__session`: Firebase Hosting (Fastly) strips all other
    // cookies before forwarding requests to the Cloud Run backend.
    response.cookies.set('__session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })

    return response
  } catch (error: any) {
    console.error('Firebase auth error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
