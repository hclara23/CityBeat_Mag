import { NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getStripe } from '@/lib/platform/stripe-connect'

export const dynamic = 'force-dynamic'

// Returns the signed-in user's connected-account balance + recent payouts/transfers.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const acctDoc = await adminDb.collection('stripe_connected_accounts').doc(user.id).get()
  const acct = acctDoc.exists ? (acctDoc.data() as any) : null
  if (!acct?.stripe_account_id) {
    return NextResponse.json({ connected: false, balance: null, payouts: [], transfers: [] })
  }

  try {
    const stripe = getStripe()
    const stripeAccount = acct.stripe_account_id

    const [balance, payouts] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount }),
      stripe.payouts.list({ limit: 10 }, { stripeAccount }),
    ])

    // Transfers we sent to this user (from our Firestore ledger).
    const transfersSnap = await adminDb
      .collection('transfers')
      .where('payee_user_id', '==', user.id)
      .get()
    const transfers = transfersSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((t) => t.status === 'paid')
      .sort((a: any, b: any) => (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0))
      .slice(0, 20)

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
    })
  } catch (error: any) {
    // A stored account that can't be retrieved (e.g. created in a different
    // Stripe mode) is treated as not-connected so the user can re-onboard.
    console.warn('connect/balance: could not load connected account:', error?.message)
    return NextResponse.json({ connected: false, balance: null, payouts: [], transfers: [], stale: true })
  }
}
