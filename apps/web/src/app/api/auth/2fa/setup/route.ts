import { NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { generateMfaSecret, buildMfaEnrollment } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// Begins TOTP enrollment: generates a secret, stores it as a *temp* secret (not
// yet active), and returns the QR + otpauth URI for the authenticator app.
// The secret is kept in the server-only `user_mfa` collection, never in profiles.
export async function POST() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = generateMfaSecret()
  await adminDb.collection('user_mfa').doc(user.id).set(
    { temp_secret: secret, updated_at: FieldValue.serverTimestamp() },
    { merge: true }
  )

  const { qrDataUrl, otpauth } = await buildMfaEnrollment(user.email || 'account', secret)
  // `secret` is returned for manual entry into apps that don't scan QR codes.
  return NextResponse.json({ qrDataUrl, otpauth, secret })
}
