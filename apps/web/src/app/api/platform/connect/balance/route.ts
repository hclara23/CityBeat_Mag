import { NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getStripe } from '@/lib/platform/stripe-connect'
import { commissionDisplayState, totalByState } from '@/lib/commission-schedule'

export const dynamic = 'force-dynamic'

// Recent-first ordering across the accrual model's mixed timestamp shapes:
// accrued_at/created_at are Firestore timestamps, sale_at is an ISO string.
function rowTime(row: any): number {
  if (typeof row.sale_at === 'string') {
    const parsed = Date.parse(row.sale_at)
    if (Number.isFinite(parsed)) return parsed
  }
  return (row.accrued_at?._seconds || row.created_at?._seconds || 0) * 1000
}

// Returns the signed-in user's connected-account balance plus their full
// commission ledger — not just what's been paid. A rep needs to see money that
// is accrued-but-held (and the date it lands) as much as money already banked,
// otherwise a sale looks like it earned them nothing for up to three weeks.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The commission ledger is independent of Stripe onboarding: a rep who has not
  // connected a bank yet still needs to see what they have earned (and that it
  // is waiting on them to connect). Read it before the connected-account check.
  const ledgerSnap = await adminDb
    .collection('transfers')
    .where('payee_user_id', '==', user.id)
    .get()
    .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))

  const now = new Date()
  const ledger = ledgerSnap.docs
    .map((d) => {
      const data = d.data() as any
      const { state, payoutDate } = commissionDisplayState(data, now)
      return { id: d.id, ...data, commission_state: state, payout_date: payoutDate }
    })
    .sort((a, b) => rowTime(b) - rowTime(a))

  const commission = totalByState(ledger, now)
  const transfers = ledger.filter((t) => t.status === 'paid').slice(0, 20)
  const upcoming = ledger
    .filter((t) =>
      ['held', 'due', 'failed', 'no_bank'].includes(String(t.commission_state))
    )
    .slice(0, 20)

  const acctDoc = await adminDb.collection('stripe_connected_accounts').doc(user.id).get()
  const acct = acctDoc.exists ? (acctDoc.data() as any) : null
  if (!acct?.stripe_account_id) {
    return NextResponse.json({
      connected: false,
      balance: null,
      payouts: [],
      transfers,
      upcoming,
      commission,
    })
  }

  try {
    const stripe = getStripe()
    const stripeAccount = acct.stripe_account_id

    const [balance, payouts] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount }),
      stripe.payouts.list({ limit: 10 }, { stripeAccount }),
    ])

    return NextResponse.json({
      connected: true,
      payouts_enabled: Boolean(acct.payouts_enabled),
      balance: {
        available: balance.available,
        pending: balance.pending,
      },
      payouts: payouts.data.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        arrival_date: p.arrival_date,
      })),
      transfers,
      upcoming,
      commission,
    })
  } catch (error: any) {
    // A stored account that can't be retrieved (e.g. created in a different
    // Stripe mode) is treated as not-connected so the user can re-onboard —
    // but their earned commission is still reported.
    console.warn('connect/balance: could not load connected account:', error?.message)
    return NextResponse.json({
      connected: false,
      balance: null,
      payouts: [],
      transfers,
      upcoming,
      commission,
      stale: true,
    })
  }
}
