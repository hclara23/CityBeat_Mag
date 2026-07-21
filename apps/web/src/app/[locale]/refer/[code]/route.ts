import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { resolveReferralLanding } from '@/lib/referrals-server'
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  normalizeReferralCode,
} from '@/lib/referrals'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { locale: string; code: string } }
) {
  const locale = params.locale === 'es' ? 'es' : 'en'
  const code = normalizeReferralCode(params.code)
  const destination = new URL(`/${locale}/directory`, request.url)
  if (!code) {
    destination.searchParams.set('referral', 'invalid')
    return NextResponse.redirect(destination)
  }

  const referral = await resolveReferralLanding(code)
  if (!referral) {
    destination.searchParams.set('referral', 'inactive')
    return NextResponse.redirect(destination)
  }

  await adminDb
    .collection('referral_codes')
    .doc(code)
    .set(
      {
        click_count: FieldValue.increment(1),
        last_clicked_at: new Date().toISOString(),
      },
      { merge: true }
    )
    .catch(() => {})

  destination.searchParams.set('referral', 'saved')
  // Firebase Hosting may forward only the authentication cookie to Cloud Run,
  // so the public code also travels in the redirect and is stored client-side
  // with the same 30-day expiry. Checkout still validates it server-side.
  destination.searchParams.set('ref', code)
  const response = NextResponse.redirect(destination)
  response.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
  })
  return response
}
