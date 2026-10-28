import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { createSalesOrderAccess, salesOrderAccessExpiresAt } from '@/lib/sales-orders'
import { intakeRecoveryError } from '@/lib/intake-recovery'

export const dynamic = 'force-dynamic'

// A staff-assisted recovery never changes payment, ownership, or the original
// token. Existing customer links remain valid until their original expiration.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile) || !profile?.mfa_enabled) {
    return NextResponse.json({ error: 'Sales access and two-factor authentication required' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  if (typeof body.orderId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(body.orderId)) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  }
  const access = createSalesOrderAccess()
  const now = new Date()
  const expiresAt = salesOrderAccessExpiresAt(now)
  const ref = adminDb.collection('sales_orders').doc(body.orderId)
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { error: 'Order not found' }
      const order = snap.data()!
      const error = intakeRecoveryError(order)
      if (error) return { error }
      tx.update(ref, {
        intake_recovery_token_hash: access.tokenHash,
        intake_recovery_expires_at: expiresAt,
        intake_recovery_created_at: now.toISOString(),
        intake_recovery_created_by: user.id,
        updated_at: now.toISOString(),
      })
      return { locale: order.locale === 'es' ? 'es' : 'en' }
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 })
    const url = new URL(`/${result.locale}/fulfill/${body.orderId}`, process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co')
    url.searchParams.set('access', access.token)
    return NextResponse.json({ url: url.toString(), expiresAt }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not create recovery link. Please try again.' }, { status: 500 })
  }
}
