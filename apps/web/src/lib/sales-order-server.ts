import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { salesOrderAccessExpired, salesOrderTokenMatches } from './sales-orders'

export class SalesOrderAccessError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message)
  }
}

function stripeId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in value && typeof (value as any).id === 'string') return (value as any).id
  return null
}

export async function authorizePaidSalesOrder(input: {
  orderId: string
  accessToken: string
  sessionId?: string
}): Promise<{ ref: FirebaseFirestore.DocumentReference; order: Record<string, any> }> {
  if (!input.orderId || !input.accessToken) {
    throw new SalesOrderAccessError('This order link is incomplete.', 401, 'missing_access')
  }

  const ref = adminDb.collection('sales_orders').doc(input.orderId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new SalesOrderAccessError('Order not found.', 404, 'order_not_found')
  let order = snapshot.data() as Record<string, any>

  if (!salesOrderTokenMatches(input.accessToken, order.intake_token_hash)) {
    throw new SalesOrderAccessError('This order link is not valid.', 403, 'invalid_access')
  }
  if (salesOrderAccessExpired(order.intake_expires_at)) {
    throw new SalesOrderAccessError('This order link has expired. Contact CityBeat for a new link.', 410, 'access_expired')
  }

  // Stripe can redirect the customer before the webhook reaches Firestore. In
  // that narrow race, verify the exact Session against Stripe and update only the
  // matching order. A session id supplied for another order is never accepted.
  if (order.payment_status !== 'paid' && input.sessionId) {
    if (input.sessionId !== order.stripe_checkout_session_id) {
      throw new SalesOrderAccessError('This payment does not match the order.', 403, 'session_mismatch')
    }
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new SalesOrderAccessError('Payment verification is temporarily unavailable.', 503, 'stripe_unavailable')
    const stripe = new Stripe(key, { apiVersion: '2023-08-16' })
    const session = await stripe.checkout.sessions.retrieve(input.sessionId)
    const belongsToOrder = session.metadata?.sales_order_id === input.orderId
    const isPaid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
    if (!belongsToOrder || !isPaid) {
      throw new SalesOrderAccessError('Payment has not completed for this order.', 402, 'payment_required')
    }
    const patch = {
      checkout_status: 'completed',
      payment_status: 'paid',
      fulfillment_status: 'awaiting_intake',
      stripe_customer_id: stripeId(session.customer),
      stripe_subscription_id: stripeId(session.subscription),
      stripe_payment_intent_id: stripeId(session.payment_intent),
      amount_paid: session.amount_total || 0,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await ref.set(patch, { merge: true })
    order = { ...order, ...patch }
  }

  if (order.payment_status !== 'paid') {
    throw new SalesOrderAccessError('Complete payment before opening the fulfillment brief.', 402, 'payment_required')
  }

  return { ref, order: { ...order, id: snapshot.id } }
}

export function publicSalesOrder(order: Record<string, any>) {
  return {
    id: order.id,
    product_id: order.product_id,
    product_family: order.product_family,
    product_name: order.product_name,
    intake_kind: order.intake_kind,
    billing_type: order.billing_type,
    billing_interval: order.billing_interval,
    amount: order.amount,
    amount_paid: order.amount_paid ?? order.amount,
    currency: order.currency || 'usd',
    business_name: order.business_name,
    contact_email: order.contact_email,
    contact_phone: order.contact_phone,
    payment_status: order.payment_status,
    intake_status: order.intake_status,
    fulfillment_status: order.fulfillment_status,
    intake_current_step: order.intake_current_step || 0,
    intake_data: order.intake_data || {},
    assets: Array.isArray(order.assets) ? order.assets : [],
    updated_at: order.updated_at,
  }
}
