import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit, validatePassword, isPasswordBreached } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

async function sendVerificationEmail(email: string) {
  // Firebase generates a one-time verification link handled by its hosted action
  // page; we deliver it ourselves via Resend so it matches our domain/branding.
  const link = await adminAuth.generateEmailVerificationLink(email, { url: `${APP_URL}/en/login` })
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>Welcome! Please confirm your email address to activate your CityBeat account.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">Verify my email</a></p>
  <p style="color:#666;font-size:13px">If the button doesn't work, copy this link into your browser:<br/><span style="word-break:break-all">${link}</span></p>
  <p style="color:#999;font-size:12px">If you didn't create a CityBeat account, you can ignore this email.</p>
</div>`
  await sendEmail(email, 'Verify your CityBeat email', html)
}

export async function POST(request: NextRequest) {
  // Rate limit signups per IP to curb automated account creation.
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`signup:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 3600) } }
    )
  }

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
        mfa_enabled: false,
        email_verified: false,
        review_points: 0,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      })

    // Send verification email (don't fail the signup if delivery hiccups).
    try {
      await sendVerificationEmail(email)
    } catch (e) {
      console.error('Verification email send failed:', e)
    }

    return NextResponse.json(
      {
        ok: true,
        uid: userRecord.uid,
        verifyEmailSent: true,
        message: 'Account created. Check your email to verify your address before signing in.',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: error?.message || 'Could not create account' }, { status: 500 })
  }
}
