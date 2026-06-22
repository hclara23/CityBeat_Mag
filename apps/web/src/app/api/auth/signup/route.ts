import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : ''
  const isAdvertiser = Boolean(body.isAdvertiser)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  try {
    // Reject if the email already exists.
    try {
      await adminAuth.getUserByEmail(email)
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    } catch {
      /* not found — good, continue */
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: fullName || undefined,
      emailVerified: false,
    })

    await adminDb
      .collection('profiles')
      .doc(userRecord.uid)
      .set({
        id: userRecord.uid,
        email,
        full_name: fullName || null,
        company_name: companyName || null,
        phone_number: phoneNumber || null,
        is_advertiser: isAdvertiser,
        is_developer: false,
        is_editor: false,
        is_writer: false,
        is_sales: false,
        role: isAdvertiser ? 'advertiser' : 'reader',
        sales_dashboard_enabled: false,
        stripe_connect_onboarding_complete: false,
        email_notifications_enabled: true,
        sms_notifications_enabled: false,
        review_points: 0,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      })

    return NextResponse.json({ ok: true, uid: userRecord.uid }, { status: 201 })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: error?.message || 'Could not create account' }, { status: 500 })
  }
}
