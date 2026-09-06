import { PAID_STATUSES } from './finance-rollup'

// What an `ad_purchases` row (one-time ads, jobs, events, rep-sold custom
// amounts) contributes to collected revenue. Split out from finance-rollup's
// `collectedCents` because purchase rows carry the money in `amount_total` and
// the state in `payment_status`, where invoice rows use `amount`/`status`.

/**
 * Statuses that mean money was collected on a purchase row.
 *
 * `partially_refunded` belongs here. The Stripe webhook's handleChargeRefunded
 * flips a partially refunded purchase to that status, and it is not in
 * PAID_STATUSES — so the finance dashboard and the ops digest counted the row
 * as zero: refunding $20 of a $500 category banner erased $500 of real,
 * collected revenue from the operator's books, and from that month's total.
 * The invoice ledger never had this bug because a partial refund leaves a
 * `payments` row 'paid' and records amount_refunded, which is subtracted.
 */
export const PURCHASE_COLLECTED_STATUSES = [...PAID_STATUSES, 'partially_refunded'] as const

export function purchaseStatusIsCollected(status: unknown): boolean {
  return (PURCHASE_COLLECTED_STATUSES as readonly string[]).includes(String(status ?? ''))
}

/**
 * Collected cents for a purchase row, net of any refund recorded ON THAT ROW.
 *
 * Status is deliberately not consulted (mirroring collectedCents): callers gate
 * the TOTALS with purchaseStatusIsCollected and still want the row's amount for
 * the table, including for a pending order that has not been paid yet.
 *
 * The refund AMOUNT is only subtracted when a writer recorded one. Today the
 * webhook writes only `payment_status` onto `ad_purchases` — the cents live on
 * the linked sales_orders row (`refund_amount`) and on the invoice — so a
 * partial refund of a purchase currently counts gross here. Gross is wrong by
 * the refunded amount; the behaviour it replaces was wrong by the entire sale.
 */
export function purchaseCollectedCents(row: {
  amount_total?: unknown
  amount_refunded?: unknown
  refund_amount?: unknown
}): number {
  const amount = Math.max(0, Math.round(Number(row.amount_total) || 0))
  const recordedRefund = row.amount_refunded ?? row.refund_amount
  const refunded = Math.max(0, Math.round(Number(recordedRefund) || 0))
  return Math.max(0, amount - refunded)
}
