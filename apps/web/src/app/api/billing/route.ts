import { NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toIso(v: any): string {
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : new Date(0).toISOString()
}

function mapSubscription(row: any) {
  return {
    id: row.id,
    stripe_subscription_id: row.stripe_subscription_id ?? undefined,
    stripe_customer_id: row.stripe_customer_id ?? undefined,
    ad_type: row.plan_id ?? 'advertising',
    amount_total: Number(row.amount_total ?? row.price_per_month ?? 0),
    billing_cycle: row.billing_cycle ?? 'monthly',
    payment_status: row.payment_status ?? row.status ?? 'pending',
    created_at: toIso(row.created_at),
  }
}

function mapInvoice(row: any) {
  return {
    id: row.stripe_charge_id ?? row.id,
    amount: Number(row.amount ?? row.amount_total ?? 0),
    date: toIso(row.created_at),
    status: row.status ?? row.payment_status ?? 'unknown',
    pdfUrl: row.invoice_pdf ?? undefined,
  }
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [subsSnap, paysSnap] = await Promise.all([
      adminDb.collection('subscriptions').where('advertiser_id', '==', user.id).get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('payments').where('advertiser_id', '==', user.id).get().catch(() => ({ docs: [] as any[] })),
    ])

    const subscriptions = (subsSnap.docs as any[])
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (toIso(b.created_at) > toIso(a.created_at) ? 1 : -1))
      .map(mapSubscription)

    const invoices = (paysSnap.docs as any[])
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (toIso(b.created_at) > toIso(a.created_at) ? 1 : -1))
      .slice(0, 25)
      .map(mapInvoice)

    return NextResponse.json({ subscriptions, invoices })
  } catch (error) {
    console.error('billing error:', error)
    return NextResponse.json({ error: 'Failed to load billing' }, { status: 500 })
  }
}
