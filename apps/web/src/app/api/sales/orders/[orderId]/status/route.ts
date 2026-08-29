import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { authorizeSalesOrderStatus, SalesOrderAccessError } from '@/lib/sales-order-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// A multi-item cart pays for several orders in one Stripe session; they all share
// the same access token. When the buyer opens one, list the basket's other orders
// so a single link reaches every brief. Only cart siblings are exposed, and only
// when the opened order is itself a cart purchase — a normal single order returns
// no siblings. Minimal projection (no internal ids). Fails soft: any query error
// just yields no siblings so the primary order still renders.
async function fetchCartSiblings(primaryId: string, order: Record<string, any>): Promise<any[]> {
  if (!order?.cart_purchase || !order?.checkout_session_id) return []
  try {
    // Single-field equality — auto-indexed, no composite index needed. cart_purchase
    // and self-exclusion are filtered in memory.
    const snap = await adminDb
      .collection('sales_orders')
      .where('stripe_checkout_session_id', '==', order.checkout_session_id)
      .get()
    return snap.docs
      .filter((d) => d.id !== primaryId)
      .map((d) => ({ id: d.id, o: d.data() as Record<string, any> }))
      .filter(({ o }) => o.cart_purchase === true)
      .map(({ id, o }) => ({
        id,
        product_name: o.product_name || o.product_id || 'CityBeat order',
        fulfillment_status: o.fulfillment_status || 'awaiting_payment',
        intake_status: o.intake_status || 'not_started',
      }))
  } catch {
    return []
  }
}

// Customer-facing order status. Token-authorized (the same ?access= token the
// customer already holds from their confirmation email), and — unlike the
// intake endpoint — it does NOT require payment, so a buyer can watch an order
// move from awaiting-payment → in-review → live. Read-only; internal ids never
// leave the server (see authorizeSalesOrderStatus's projection).
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  try {
    const order = await authorizeSalesOrderStatus({
      orderId,
      accessToken: request.nextUrl.searchParams.get('access') || '',
      sessionId: request.nextUrl.searchParams.get('session_id') || undefined,
    })
    const siblings = await fetchCartSiblings(orderId, order)
    return NextResponse.json({ order: { ...order, siblings } })
  } catch (error) {
    if (error instanceof SalesOrderAccessError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not load order status' }, { status: 500 })
  }
}
