import { createHash } from 'node:crypto'
import { checkoutLinkState } from './checkout-recovery'

export function checkoutAttemptDocumentId(sellerUserId: string, key: unknown): string | null {
  const normalized = typeof key === 'string' ? key.trim() : ''
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(normalized)) return null
  const digest = createHash('sha256').update(`${sellerUserId}:${normalized}`).digest('hex')
  return `attempt_${digest.slice(0, 40)}`
}

export function checkoutAttemptHash(sellerUserId: string, key: string): string {
  return createHash('sha256').update(`${sellerUserId}:${key.trim()}`).digest('hex')
}

export function checkoutRenewalError(order: Record<string, any>, sellerUserId: string, now = new Date()): string | null {
  if (order.sold_by !== sellerUserId) return 'renewal_forbidden'
  if (order.payment_status === 'paid' || order.checkout_status === 'completed') return 'order_paid'
  if (checkoutLinkState(order, now) !== 'expired') return 'checkout_still_live'
  return null
}

export function isStripeResourceMissing(error: any): boolean {
  return error?.code === 'resource_missing' || error?.raw?.code === 'resource_missing'
}

export function replacementCompensationOutcome(compensationError: any): {
  auditStatus: 'new_session_expired_after_old_expiry_failure' | 'compensation_failed'
  orderStatus: 'failed' | 'needs_attention'
  errorCode: 'replacement_old_expiry_failed' | 'replacement_compensation_failed'
} {
  return compensationError
    ? { auditStatus: 'compensation_failed', orderStatus: 'needs_attention', errorCode: 'replacement_compensation_failed' }
    : { auditStatus: 'new_session_expired_after_old_expiry_failure', orderStatus: 'failed', errorCode: 'replacement_old_expiry_failed' }
}

export function oldCheckoutRetirementState(session: { status?: unknown; payment_status?: unknown } | null): 'open' | 'retired' | 'completed' | 'unknown' {
  if (!session) return 'unknown'
  if (session.status === 'expired') return 'retired'
  if (session.status === 'complete' || session.payment_status === 'paid') return 'completed'
  if (session.status === 'open') return 'open'
  return 'unknown'
}
