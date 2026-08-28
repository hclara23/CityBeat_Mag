import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { COMMISSION_OWED_STATUSES, PAID_STATUSES, collectedCents, purchaseRowCounts } from '@/lib/finance-rollup'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  if (v?._seconds) return new Date(v._seconds * 1000).toISOString()
  return typeof v === 'string' ? v : null
}
function monthKey(iso: string | null): string {
  return iso ? iso.slice(0, 7) : 'unknown'
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const [paymentsSnap, purchasesSnap, transfersSnap, subsSnap, listingsSnap, referralsSnap, balancesSnap] = await Promise.all([
      adminDb.collection('payments').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('ad_purchases').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('transfers').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('subscriptions').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('directory_listings').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('referrals').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('referral_balances').get().catch(() => ({ docs: [] as any[] })),
    ])

    const subscriptions = new Map(
      (subsSnap.docs as any[]).map((d) => [d.id, { id: d.id, ...(d.data() as any) }])
    )
    const listings = new Map(
      (listingsSnap.docs as any[]).map((d) => [d.id, { id: d.id, ...(d.data() as any) }])
    )

    // Incoming = invoice payments + ad purchases.
    const incoming = [
      ...(paymentsSnap.docs as any[]).map((d) => {
        const x = d.data()
        const subscription = subscriptions.get(String(x.stripe_subscription_id || '')) as any
        const listingId = x.listing_id || subscription?.listing_id || null
        const listing = listingId ? (listings.get(listingId) as any) : null
        // Net of refunds: the webhook records amount_refunded on partial
        // refunds and flips status to 'refunded' on full ones.
        const amount = collectedCents(x)
        const discountAmount = Number(x.discount_amount) || 0
        return {
          id: d.id,
          source: 'invoice',
          service: listing ? 'directory listing' : subscription?.payout_service || 'subscription',
          amount,
          gross_amount: Number(x.gross_amount) || amount + discountAmount,
          discount_amount: discountAmount,
          discount_source: x.discount_source || null,
          discount_coupon_id: x.discount_coupon_id || null,
          currency: x.currency || 'usd',
          status: x.status,
          created_at: toIso(x.created_at),
          email: x.advertiser_email || null,
          listing_id: listingId,
          listing_name: listing?.name || null,
          plan: x.plan || subscription?.plan_id || listing?.plan || null,
          billing_cycle: x.billing_cycle || subscription?.billing_cycle || null,
        }
      }),
      ...(purchasesSnap.docs as any[]).filter((d) => purchaseRowCounts(d.data() as any)).map((d) => {
        const x = d.data()
        const amount = Number(x.amount_total) || 0
        return { id: d.id, source: 'purchase', service: x.ad_type || 'advertisement', amount, gross_amount: amount, discount_amount: 0, discount_source: null, currency: x.currency || 'usd', status: x.payment_status, created_at: toIso(x.created_at), email: x.advertiser_email || null }
      }),
    ].sort((a, b) => (String(b.created_at) > String(a.created_at) ? 1 : -1))

    // Outgoing = transfers we paid to users.
    const outgoing = (transfersSnap.docs as any[])
      .map((d) => {
        const x = d.data()
        return { id: d.id, payee_user_id: x.payee_user_id, service: x.service, amount: x.amount || 0, percent: x.percent, status: x.status, created_at: toIso(x.created_at) }
      })
      .sort((a, b) => (String(b.created_at) > String(a.created_at) ? 1 : -1))

    const paidIncoming = incoming.filter((x) => (PAID_STATUSES as readonly string[]).includes(x.status))
    const totalIncoming = paidIncoming.reduce((s, x) => s + (x.amount || 0), 0)
    const totalDiscounts = paidIncoming.reduce((s, x) => s + (x.discount_amount || 0), 0)
    const totalGross = paidIncoming.reduce((s, x) => s + (x.gross_amount || x.amount || 0), 0)
    const totalPaidOut = outgoing.filter((x) => x.status === 'paid').reduce((s, x) => s + (x.amount || 0), 0)
    // Commission accrued or attempted but not yet transferred is a real
    // liability: since the accrual model, ignoring it overstated margin by up
    // to 65% of recent sales. clawback_owed is the opposite direction — money
    // a rep owes back after a post-payout refund.
    const commissionOwed = outgoing
      .filter((x) => (COMMISSION_OWED_STATUSES as readonly string[]).includes(x.status))
      .reduce((s, x) => s + (x.amount || 0), 0)
    const commissionOwedBack = outgoing
      .filter((x) => x.status === 'clawback_owed')
      .reduce((s, x) => s + (x.amount || 0), 0)

    // Monthly trend.
    const byMonth: Record<string, { month: string; incoming: number; outgoing: number }> = {}
    for (const x of paidIncoming) {
      const k = monthKey(x.created_at)
      byMonth[k] = byMonth[k] || { month: k, incoming: 0, outgoing: 0 }
      byMonth[k].incoming += x.amount || 0
    }
    for (const x of outgoing) {
      if (x.status !== 'paid') continue
      const k = monthKey(x.created_at)
      byMonth[k] = byMonth[k] || { month: k, incoming: 0, outgoing: 0 }
      byMonth[k].outgoing += x.amount || 0
    }
    const monthly = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))

    // Payouts grouped by service.
    const byService: Record<string, number> = {}
    for (const x of outgoing) {
      if (x.status !== 'paid') continue
      byService[x.service] = (byService[x.service] || 0) + (x.amount || 0)
    }

    const referrals = (referralsSnap.docs as any[])
      .map((d) => {
        const x = d.data()
        const referrer = listings.get(x.referrer_listing_id) as any
        const referred = listings.get(x.referred_listing_id) as any
        return {
          id: d.id,
          code: x.referral_code || null,
          referrer_listing_id: x.referrer_listing_id,
          referrer_listing_name: referrer?.name || x.referrer_listing_id,
          referred_listing_id: x.referred_listing_id,
          referred_listing_name: referred?.name || x.referred_listing_id,
          status: x.status || 'pending',
          started_at: toIso(x.started_at),
          eligible_at: toIso(x.eligible_at),
          qualified_at: toIso(x.qualified_at),
          qualification_year: x.qualification_year || null,
          reward_months: Number(x.reward_months) || 0,
          disqualified_reason: x.disqualified_reason || null,
        }
      })
      .sort((a, b) => (String(b.started_at) > String(a.started_at) ? 1 : -1))

    const referralBalances = (balancesSnap.docs as any[])
      .map((d) => {
        const x = d.data()
        const listing = listings.get(d.id) as any
        return {
          listing_id: d.id,
          listing_name: listing?.name || d.id,
          discount_months_remaining: Number(x.discount_months_remaining) || 0,
          discount_status: x.discount_status || 'none',
          referral_discount_percent: Number(x.referral_discount_percent) || 0,
          active_subscription_id: x.active_subscription_id || null,
          updated_at: toIso(x.updated_at),
        }
      })
      .sort((a, b) => b.discount_months_remaining - a.discount_months_remaining)

    return NextResponse.json({
      summary: {
        total_gross: totalGross,
        total_discounts: totalDiscounts,
        total_incoming: totalIncoming,
        total_paid_out: totalPaidOut,
        platform_net: totalIncoming - totalPaidOut,
        total_commission_owed: commissionOwed,
        commission_owed_back: commissionOwedBack,
        platform_net_after_owed: totalIncoming - totalPaidOut - commissionOwed,
        active_subscriptions: (subsSnap.docs as any[]).filter((d) => (d.data() as any).status === 'active').length,
        currency: 'usd',
      },
      monthly,
      payouts_by_service: byService,
      incoming: incoming.slice(0, 100),
      outgoing: outgoing.slice(0, 100),
      referrals: referrals.slice(0, 100),
      referral_balances: referralBalances,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load finance data' }, { status: 500 })
  }
}
