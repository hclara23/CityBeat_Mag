import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyTotp } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// Disables 2FA — requires a valid current TOTP code so a hijacked (cookie-only)
// session can't silently turn it off. Admin accounts will be prompted to
// re-enroll by the admin guard on their next visit.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code : ''

  const mfaRef = adminDb.collection('user_mfa').doc(user.id)
  const mfaDoc = await mfaRef.get()
  const secret = mfaDoc.exists ? (mfaDoc.data() as any).secret : null
  if (!secret) {
    return NextResponse.json({ error: '2FA is not enabled.' }, { status: 400 })
  }

  if (!verifyTotp(secret, code)) {
    return NextResponse.json({ error: 'Invalid code.' }, { status: 400 })
  }

  await mfaRef.set(
    { secret: FieldValue.delete(), temp_secret: FieldValue.delete(), enabled: false, updated_at: FieldValue.serverTimestamp() },
    { merge: true }
  )
  await adminDb.collection('profiles').doc(user.id).set(
    { mfa_enabled: false, updated_at: FieldValue.serverTimestamp() },
    { merge: true }
  )

  return NextResponse.json({ ok: true, mfa_enabled: false })
}
