import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyTotp } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// Confirms TOTP enrollment: verifies a code against the temp secret, then
// promotes it to the active secret and flips profile.mfa_enabled.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code : ''

  const mfaRef = adminDb.collection('user_mfa').doc(user.id)
  const mfaDoc = await mfaRef.get()
  const tempSecret = mfaDoc.exists ? (mfaDoc.data() as any).temp_secret : null
  if (!tempSecret) {
    return NextResponse.json({ error: 'Start 2FA setup first.' }, { status: 400 })
  }

  if (!verifyTotp(tempSecret, code)) {
    return NextResponse.json({ error: 'Invalid code. Make sure your device clock is correct and try again.' }, { status: 400 })
  }

  await mfaRef.set(
    { secret: tempSecret, enabled: true, temp_secret: FieldValue.delete(), updated_at: FieldValue.serverTimestamp() },
    { merge: true }
  )
  await adminDb.collection('profiles').doc(user.id).set(
    { mfa_enabled: true, updated_at: FieldValue.serverTimestamp() },
    { merge: true }
  )

  return NextResponse.json({ ok: true, mfa_enabled: true })
}
