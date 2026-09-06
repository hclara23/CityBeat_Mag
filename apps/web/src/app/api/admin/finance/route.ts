import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { COMMISSION_OWED_STATUSES, PAID_STATUSES, collectedCents, purchaseRowCounts } from '@/lib/finance-rollup'
import { purchaseCollectedCents, purchaseStatusIsCollected } from '@/lib/purchase-revenue'
import { TopN, scanCollection } from '@/lib/firestore-scan'

export const dynamic = 'force-dynamic'

// How many rows each table shows. Totals are computed over everything; only the
// lists are capped.
const ROWS = 100

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  if (v?._seconds) return new Date(v._seconds * 1000).toISOString()
  return typeof v === 'string' ? v : null
}
function monthKey(iso: string | null): string {
  return iso ? iso.slice(0, 7) : 'unknown'
}
// TopN ranks by a string score; a missing date must sort last, not first.
function sortKey(iso: string | null): string {
  return iso || ''
}

// Fetch only the documents actually referenced, in chunks getAll accepts.
async function loadByIds(collection: string, ids: Set<string>): Promise<Map<string, any>> {
  const out = new Map<string, any>()
  const list = [...ids].filter(Boolean)
  for (let i = 0; i < list.length; i += 250) {
    const refs = list.slice(i, i + 250).map((id) => adminDb.collection(collection).doc(id))
    const docs = await adminDb.getAll(...refs).catch(() => [])
    for (const doc of docs) {
      if (doc.exists) out.set(doc.id, { id: doc.id, ...(doc.data() as any) })
    }
  }
  return out
}

type IncomingRow = {
  id: string
  source: string
  service: string
  amount: number
  gross_amount: number
  discount_amount: number
  discount_source: string | null
  discount_coupon_id?: string | null
  currency: string
  status: string
  created_at: string | null
  email: string | null
  listing_id?: string | null
  listing_name?: string | null
  subscription_id?: string | null
  plan?: string | null
  billing_cycle?: string | null
}

type OutgoingRow = {
  id: string
  payee_user_id: string
  service: string
  amount: number
  percent: number
  status: string
  created_at: string | null
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  // Every revenue figure, every payee, every commission liability. The admin PAGE
  // forces 2FA enrolment; this API is what actually holds the data, and it was one
  // of the routes still accepting a password-only session.
  const denial = privilegedDenial(profile, hasDeveloperAccess(profile))
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status })

  try {
    // This route used to call .get() on SEVEN whole collections at once and hold
    // every document in memory — including directory_listings, thousands of rows
    // that grow every night from the scraper, read in full to decorate at most
    // 300 displayed rows with names. Peak allocation for one page load scaled
    // with the size of the business, and an out-of-memory kill takes down the
    // instance serving the whole site, not just the admin page.
    //
    // Now: the three ledgers are streamed in pages (exact totals, bounded
    // memory), the two lookup collections are fetched by referenced id only, and
    // the single figure that genuinely needed a whole collection is a count().

    const topIncoming = new TopN<IncomingRow>(ROWS)
    const topOutgoing = new TopN<OutgoingRow>(ROWS)
    const byMonth: Record<string, { month: string; incoming: number; outgoing: number }> = {}
    const byService: Record<string, number> = {}
    const referencedSubscriptions = new Set<string>()
    const referencedListings = new Set<string>()

    let totalIncoming = 0
    let totalDiscounts = 0
    let totalGross = 0
    let totalPaidOut = 0
    let commissionOwed = 0
    let commissionOwedBack = 0

    const addMonth = (iso: string | null, key: 'incoming' | 'outgoing', cents: number) => {
      const k = monthKey(iso)
      byMonth[k] = byMonth[k] || { month: k, incoming: 0, outgoing: 0 }
      byMonth[k][key] += cents
    }

    const paid = PAID_STATUSES as readonly string[]
    const owedStatuses = COMMISSION_OWED_STATUSES as readonly string[]

    const [paymentsScan, purchasesScan, transfersScan, activeSubs] = await Promise.all([
      scanCollection(adminDb.collection('payments'), (d) => {
        const x = d.data() as any
        const createdAt = toIso(x.created_at)
        const amount = collectedCents(x)
        const discountAmount = Number(x.discount_amount) || 0
        const grossAmount = Number(x.gross_amount) || amount + discountAmount
        const subscriptionId = String(x.stripe_subscription_id || '')
        if (subscriptionId) referencedSubscriptions.add(subscriptionId)
        if (x.listing_id) referencedListings.add(String(x.listing_id))
        if (paid.includes(x.status)) {
          totalIncoming += amount
          totalDiscounts += discountAmount
          totalGross += grossAmount
          addMonth(createdAt, 'incoming', amount)
        }
        topIncoming.add(sortKey(createdAt), {
          id: d.id,
          source: 'invoice',
          // service / listing_name are resolved after the lookup pass below.
          service: x.payout_service || 'subscription',
          amount,
          gross_amount: grossAmount,
          discount_amount: discountAmount,
          discount_source: x.discount_source || null,
          discount_coupon_id: x.discount_coupon_id || null,
          currency: x.currency || 'usd',
          status: x.status,
          created_at: createdAt,
          email: x.advertiser_email || null,
          listing_id: x.listing_id || null,
          subscription_id: subscriptionId || null,
          plan: x.plan || null,
          billing_cycle: x.billing_cycle || null,
        })
      }),

      scanCollection(adminDb.collection('ad_purchases'), (d) => {
        const x = d.data() as any
        // A purchase that opened a subscription is shadowed by its own first
        // invoice in `payments`; counting both double-counts month one.
        if (!purchaseRowCounts(x)) return
        const createdAt = toIso(x.created_at)
        // Net of any refund recorded on the row, and counting the
        // `partially_refunded` state as the collected revenue it is: refunding
        // $20 of a $500 banner used to strike the entire $500 from the totals
        // and from that month, because the status gate below only accepted
        // PAID_STATUSES. See lib/purchase-revenue.ts.
        const amount = purchaseCollectedCents(x)
        if (purchaseStatusIsCollected(x.payment_status)) {
          totalIncoming += amount
          totalGross += amount
          addMonth(createdAt, 'incoming', amount)
        }
        topIncoming.add(sortKey(createdAt), {
          id: d.id,
          source: 'purchase',
          service: x.ad_type || 'advertisement',
          amount,
          gross_amount: amount,
          discount_amount: 0,
          discount_source: null,
          currency: x.currency || 'usd',
          status: x.payment_status,
          created_at: createdAt,
          email: x.advertiser_email || null,
        })
      }),

      scanCollection(adminDb.collection('transfers'), (d) => {
        const x = d.data() as any
        const createdAt = toIso(x.created_at)
        const amount = Number(x.amount) || 0
        if (x.status === 'paid') {
          totalPaidOut += amount
          addMonth(createdAt, 'outgoing', amount)
          byService[x.service] = (byService[x.service] || 0) + amount
        }
        // Accrued or attempted but not transferred is a real liability; ignoring
        // it overstated margin by up to 65% of recent sales.
        if (owedStatuses.includes(x.status)) commissionOwed += amount
        // The opposite direction: money a rep owes back after a post-payout
        // refund. A PARTIAL refund leaves the row `paid` and records only the
        // difference, so that field has to count too or the debt reads as zero.
        if (x.status === 'clawback_owed') commissionOwedBack += amount
        else commissionOwedBack += Math.max(0, Math.round(Number(x.clawback_owed_amount) || 0))
        topOutgoing.add(sortKey(createdAt), {
          id: d.id,
          payee_user_id: x.payee_user_id,
          service: x.service,
          amount,
          percent: x.percent,
          status: x.status,
          created_at: createdAt,
        })
      }),

      adminDb
        .collection('subscriptions')
        .where('status', '==', 'active')
        .count()
        .get()
        .then((s) => s.data().count)
        .catch(() => 0),
    ])

    // Referrals and their balances are human-sized and displayed in full; read a
    // bounded window rather than the collection.
    const [referralsSnap, balancesSnap] = await Promise.all([
      adminDb
        .collection('referrals')
        .limit(ROWS * 5)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      adminDb
        .collection('referral_balances')
        .limit(ROWS * 5)
        .get()
        .catch(() => ({ docs: [] as any[] })),
    ])

    for (const d of referralsSnap.docs as any[]) {
      const x = d.data()
      if (x.referrer_listing_id) referencedListings.add(String(x.referrer_listing_id))
      if (x.referred_listing_id) referencedListings.add(String(x.referred_listing_id))
    }
    for (const d of balancesSnap.docs as any[]) referencedListings.add(d.id)

    // Only now, knowing exactly which ones are displayed, fetch the lookups.
    const subscriptions = await loadByIds('subscriptions', referencedSubscriptions)
    for (const sub of subscriptions.values()) {
      if (sub.listing_id) referencedListings.add(String(sub.listing_id))
    }
    const listings = await loadByIds('directory_listings', referencedListings)

    const incoming = topIncoming.values().map((row) => {
      if (row.source !== 'invoice') return row
      const subscription = row.subscription_id ? subscriptions.get(row.subscription_id) : null
      const listingId = row.listing_id || subscription?.listing_id || null
      const listing = listingId ? listings.get(listingId) : null
      return {
        ...row,
        service: listing ? 'directory listing' : subscription?.payout_service || row.service,
        listing_id: listingId,
        listing_name: listing?.name || null,
        plan: row.plan || subscription?.plan_id || listing?.plan || null,
        billing_cycle: row.billing_cycle || subscription?.billing_cycle || null,
      }
    })
    const outgoing = topOutgoing.values()

    const monthly = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))

    const referrals = (referralsSnap.docs as any[])
      .map((d) => {
        const x = d.data()
        const referrer = listings.get(x.referrer_listing_id)
        const referred = listings.get(x.referred_listing_id)
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
      .slice(0, ROWS)

    const referralBalances = (balancesSnap.docs as any[])
      .map((d) => {
        const x = d.data()
        const listing = listings.get(d.id)
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

    // If a ledger ever outgrows its scan cap, the totals above are computed from
    // part of the data. Say so rather than presenting a wrong number as fact.
    const truncated = paymentsScan.truncated || purchasesScan.truncated || transfersScan.truncated

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
        active_subscriptions: activeSubs,
        currency: 'usd',
        truncated,
        scanned: {
          payments: paymentsScan.scanned,
          ad_purchases: purchasesScan.scanned,
          transfers: transfersScan.scanned,
        },
      },
      monthly,
      payouts_by_service: byService,
      incoming,
      outgoing,
      referrals,
      referral_balances: referralBalances,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load finance data' }, { status: 500 })
  }
}
