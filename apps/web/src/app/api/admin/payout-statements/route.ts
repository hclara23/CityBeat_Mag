import { NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'

export const dynamic = 'force-dynamic'

// Operational visibility for delivery/audit records. The stored statement is
// payee-scoped and contains no bank numbers or secrets.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  const denial = privilegedDenial(profile, hasDeveloperAccess(profile))
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status })
  const snap = await adminDb.collection('payout_statement_deliveries').orderBy('period', 'desc').limit(200).get()
  return NextResponse.json({ statements: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) })
}
