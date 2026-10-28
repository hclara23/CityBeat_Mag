import { salesOrderAccessExpired, salesOrderTokenMatches } from './sales-orders'

export function validIntakeAccess(order: Record<string, any>, token: string, now = new Date()): boolean {
  return [
    [order.intake_token_hash, order.intake_expires_at],
    [order.intake_recovery_token_hash, order.intake_recovery_expires_at],
  ].some(([hash, expiry]) => salesOrderTokenMatches(token, hash) && !salesOrderAccessExpired(expiry, now))
}

export function intakeRecoveryError(order: Record<string, any>): string | null {
  if (order.payment_status !== 'paid') return 'order_not_paid'
  if (['canceled', 'cancelled', 'unpaid', 'refunded'].includes(order.billing_status)) return 'billing_inactive'
  if (order.intake_status === 'submitted') return 'already_submitted'
  if (!['awaiting_intake', 'needs_attention'].includes(order.fulfillment_status)) return 'not_awaiting_intake'
  return null
}
