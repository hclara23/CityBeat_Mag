import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SalesProduct } from './sales-products'

export type SalesPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type SalesIntakeStatus = 'not_started' | 'in_progress' | 'submitted'
export type SalesFulfillmentStatus =
  | 'awaiting_payment'
  | 'awaiting_intake'
  | 'ready'
  | 'provisioning'
  | 'in_review'
  | 'fulfilled'
  | 'needs_attention'

export const SALES_ORDER_TOKEN_BYTES = 32
export const SALES_ORDER_ACCESS_DAYS = 30

export function hashSalesOrderToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createSalesOrderAccess(): { token: string; tokenHash: string } {
  const token = randomBytes(SALES_ORDER_TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashSalesOrderToken(token) }
}

export function salesOrderTokenMatches(token: string, expectedHash: unknown): boolean {
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) return false
  const actual = Buffer.from(hashSalesOrderToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function salesOrderAccessExpiresAt(now = new Date()): string {
  return new Date(now.getTime() + SALES_ORDER_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function salesOrderAccessExpired(value: unknown, now = new Date()): boolean {
  if (typeof value !== 'string') return true
  const expiresAt = Date.parse(value)
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime()
}

export function buildSalesOrderRecord(input: {
  product: SalesProduct
  amount: number
  businessName: string
  contactEmail: string
  contactPhone?: string
  locale: 'en' | 'es'
  sellerUserId: string
  listingId?: string
  customDescription?: string
  listingPreexisting?: boolean
  tokenHash: string
  now?: Date
}) {
  const now = input.now || new Date()
  return {
    product_id: input.product.id,
    product_family: input.product.family,
    product_name: input.product.shortName,
    intake_kind: input.product.intakeKind,
    billing_type: input.product.billing,
    billing_interval: input.product.interval,
    amount: input.amount,
    currency: 'usd',
    business_name: input.businessName,
    contact_email: input.contactEmail,
    contact_phone: input.contactPhone || null,
    locale: input.locale,
    sold_by: input.sellerUserId,
    payout_user_id: input.sellerUserId,
    listing_id: input.listingId || null,
    listing_preexisting: Boolean(input.listingPreexisting),
    directory_plan_id: input.product.directoryPlanId || null,
    founding: Boolean(input.product.founding),
    custom_description: input.customDescription || null,
    payment_status: 'pending' as SalesPaymentStatus,
    billing_status: 'pending',
    intake_status: 'not_started' as SalesIntakeStatus,
    fulfillment_status: 'awaiting_payment' as SalesFulfillmentStatus,
    intake_token_hash: input.tokenHash,
    intake_expires_at: salesOrderAccessExpiresAt(now),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
}

export function salesOrderHandoffMatches(input: {
  order: Record<string, unknown>
  sellerUserId: string
  checkoutUrl: string
  orderId?: string
  now?: Date
}): boolean {
  const { order } = input
  if (order.sold_by !== input.sellerUserId || order.checkout_url !== input.checkoutUrl) return false
  if (input.orderId && order.id !== input.orderId) return false
  if (order.checkout_status !== 'ready') return false
  if (typeof order.checkout_expires_at === 'string') {
    const expiresAt = Date.parse(order.checkout_expires_at)
    if (!Number.isFinite(expiresAt) || expiresAt <= (input.now || new Date()).getTime()) return false
  }
  try {
    const parsed = new URL(input.checkoutUrl)
    return parsed.protocol === 'https:' && ['checkout.stripe.com', 'buy.stripe.com'].includes(parsed.hostname)
  } catch {
    return false
  }
}

export function salesOrderCheckoutUrls(input: {
  origin: string
  locale: 'en' | 'es'
  orderId: string
  token: string
  billing: 'subscription' | 'one_time'
}) {
  const result = `${input.origin}/${input.locale}/checkout/result`
  const fulfillment = `${input.origin}/${input.locale}/fulfill/${encodeURIComponent(input.orderId)}`
  const access = encodeURIComponent(input.token)
  return {
    successUrl: `${fulfillment}?access=${access}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${result}?status=cancel&billing=${input.billing}&order_id=${encodeURIComponent(input.orderId)}`,
  }
}

export function salesOrderStripeMetadata(input: {
  orderId: string
  product: SalesProduct
  sellerUserId: string
  contactEmail: string
  businessName: string
  listingId?: string
}) {
  return {
    sales_order_id: input.orderId,
    product_id: input.product.id,
    product_family: input.product.family,
    intake_kind: input.product.intakeKind,
    sold_by: input.sellerUserId,
    payout_user_id: input.sellerUserId,
    contact_email: input.contactEmail,
    companyName: input.businessName,
    ...(input.listingId ? { listing_id: input.listingId } : {}),
  }
}
