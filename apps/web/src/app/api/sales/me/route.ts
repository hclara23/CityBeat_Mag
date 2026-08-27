import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { checkoutLinkState } from '@/lib/checkout-recovery'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toMs(value: any): number {
  if (!value) return 0
  if (value?.toDate) return value.toDate().getTime()
  if (value?._seconds) return value._seconds * 1000
  if (typeof value === 'string') return Date.parse(value) || 0
  return 0
}

// One cross-product sales ledger for the signed-in rep. Legacy directory deals
// remain visible, while all new products come from canonical sales_orders.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const [ordersSnapshot, listingsSnapshot, transfersSnapshot] = await Promise.all([
      adminDb.collection('sales_orders').where('sold_by', '==', user.id).get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('directory_listings').where('sold_by_rep', '==', user.id).get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('transfers').get().catch(() => ({ docs: [] as any[] })),
    ])

    const transfers = (transfersSnapshot.docs as any[]).map((document) => ({ id: document.id, ...document.data() }))
    const myPaidTransfers = transfers.filter((transfer) => transfer.payee_user_id === user.id && transfer.status === 'paid')
    const commissionBySource = new Map<string, number>()
    for (const transfer of myPaidTransfers) {
      if (!transfer.source_payment) continue
      commissionBySource.set(
        transfer.source_payment,
        (commissionBySource.get(transfer.source_payment) || 0) + (Number(transfer.amount) || 0)
      )
    }

    const now = new Date()
    const orders = (ordersSnapshot.docs as any[])
      .map((document) => {
        const data = document.data()
        return {
          id: document.id,
          name: data.business_name || 'Customer',
          product_id: data.product_id,
          product_name: data.product_name || data.product_id || 'CityBeat product',
          billing_type: data.billing_type || 'one_time',
          billing_interval: data.billing_interval || null,
          amount: data.amount_paid ?? data.amount ?? 0,
          discount_amount: data.discount_amount || 0,
          payment_status: data.payment_status || 'pending',
          billing_status: data.billing_status || (data.billing_type === 'subscription' ? 'pending' : 'completed'),
          intake_status: data.intake_status || 'not_started',
          intake_completion: data.intake_completion || 0,
          fulfillment_status: data.fulfillment_status || 'awaiting_payment',
          contact_email: data.contact_email || null,
          commission_amount: commissionBySource.get(data.stripe_checkout_session_id) || 0,
          // Derived from the clock, not from the stored status. Nothing ever
          // moved `checkout_status` off 'ready', so the desk was showing reps a
          // list of live payment links that Stripe had already expired.
          checkout_state: checkoutLinkState(data, now),
          checkout_expires_at: data.checkout_expires_at || null,
          recovery_emailed_at: data.recovery_emailed_at || null,
          created_at: toMs(data.paid_at || data.created_at),
          legacy: false,
        }
      })
      .sort((a, b) => b.created_at - a.created_at)

    const listingIdsInOrders = new Set(
      (ordersSnapshot.docs as any[])
        .map((document) => document.data()?.listing_id)
        .filter((value): value is string => typeof value === 'string' && Boolean(value))
    )
    const legacyDeals = (listingsSnapshot.docs as any[])
      .filter((document) => !listingIdsInOrders.has(document.id))
      .map((document) => {
        const data = document.data()
        const paid = Boolean(data.stripe_subscription_id)
        const free = data.requested_product_id === 'directory_basic_free'
        return {
          id: document.id,
          name: data.name || 'Business',
          product_id: free ? 'directory_basic_free' : 'legacy_directory',
          product_name: free ? 'Directory - Basic Free' : `Directory - ${data.tier || data.pending_tier || 'basic'}`,
          billing_type: free ? 'free' : 'subscription',
          billing_interval: free ? null : data.billing_cycle || 'month',
          amount: 0,
          discount_amount: 0,
          payment_status: free ? 'not_required' : paid ? 'paid' : 'pending',
          billing_status: free ? 'not_required' : paid ? 'active' : 'pending',
          intake_status: free ? 'not_required' : data.claim_status === 'approved' ? 'submitted' : 'not_started',
          intake_completion: free ? 100 : data.claim_status === 'approved' ? 100 : 0,
          fulfillment_status: free ? 'listing_live' : data.claim_status === 'approved' ? 'fulfilled' : 'in_review',
          contact_email: data.contact_email || null,
          commission_amount: 0,
          created_at: toMs(data.claimed_at || data.created_at),
          legacy: true,
        }
      })

    const deals = [...orders, ...legacyDeals].sort((a, b) => b.created_at - a.created_at)
    const paidDeals = deals.filter((deal) => deal.payment_status === 'paid')

    const byRep = new Map<string, number>()
    for (const transfer of transfers) {
      if (transfer.status !== 'paid' || !transfer.payee_user_id) continue
      byRep.set(transfer.payee_user_id, (byRep.get(transfer.payee_user_id) || 0) + (Number(transfer.amount) || 0))
    }
    const top = [...byRep.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const names = new Map<string, string>()
    await Promise.all(
      top.map(async ([userId]) => {
        const document = await adminDb.collection('profiles').doc(userId).get().catch(() => null)
        const data = document?.exists ? (document.data() as any) : null
        names.set(userId, data?.full_name || data?.email || userId.slice(0, 6))
      })
    )

    return NextResponse.json({
      summary: {
        deals_closed: paidDeals.length,
        commission_earned: myPaidTransfers.reduce((total, transfer) => total + (Number(transfer.amount) || 0), 0),
        commission_count: myPaidTransfers.length,
        discounts_granted: orders.reduce((total, order) => total + order.discount_amount, 0),
        awaiting_customer: orders.filter((order) => order.payment_status === 'paid' && order.intake_status !== 'submitted').length,
        in_fulfillment: orders.filter((order) => ['provisioning', 'in_review', 'needs_attention'].includes(order.fulfillment_status)).length,
        // Sent a link, never paid, link now dead. These are earned prospects
        // sitting unworked — the largest revenue leak the audit found.
        live_links: orders.filter((order) => order.checkout_state === 'ready').length,
        dead_links: orders.filter((order) => order.checkout_state === 'expired').length,
        currency: 'usd',
      },
      deals: deals.slice(0, 100),
      leaderboard: top.map(([userId, amount]) => ({
        name: names.get(userId) || userId.slice(0, 6),
        amount,
        me: userId === user.id,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load' }, { status: 500 })
  }
}
