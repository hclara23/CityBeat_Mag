import { NextRequest, NextResponse } from 'next/server'
import { authorizeSalesOrderStatus, SalesOrderAccessError } from '@/lib/sales-order-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
    })
    return NextResponse.json({ order })
  } catch (error) {
    if (error instanceof SalesOrderAccessError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not load order status' }, { status: 500 })
  }
}
