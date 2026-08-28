// Rules that decide what counts as collected revenue. Pure and unit-tested
// because the dashboard was double-counting and never un-counting:
//
// - The first month of every non-directory subscription was recorded TWICE —
//   once as the checkout's ad_purchases row ('completed') and once as the
//   first invoice's payments row ('paid') — and both passed the paid filter.
// - Refunds patched ad_purchases and sales_orders but never the payments
//   (invoice) ledger, so refunded subscription revenue was counted as
//   collected forever.
// See finance-rollup.test.ts for the exact regressions pinned.

/** ad_purchases rows that opened a subscription are shadowed by their own
 *  first invoice in `payments` — counting both double-counts month one.
 *  Every webhook writer of ad_purchases sets stripe_subscription_id iff the
 *  purchase opened a subscription, which is what makes this rule sound. Any
 *  NEW fulfillment branch that writes both a purchase row and invoices must
 *  keep doing so, or it will double-count. */
export function purchaseRowCounts(row: { stripe_subscription_id?: unknown }): boolean {
  return !row.stripe_subscription_id
}

/** Collected cents for a payments/purchase row, net of refunds. A fully
 *  refunded row drops out via its status; a partial refund subtracts. */
export function collectedCents(row: {
  amount?: unknown
  amount_refunded?: unknown
}): number {
  const amount = Math.max(0, Math.round(Number(row.amount) || 0))
  const refunded = Math.max(0, Math.round(Number(row.amount_refunded) || 0))
  return Math.max(0, amount - refunded)
}

export const PAID_STATUSES = ['paid', 'completed', 'succeeded'] as const

/** Commission the platform still owes: accrued or attempted but not paid.
 *  Deliberately excludes 'reversed' (clawed back before payment — owed to no
 *  one), 'clawback_owed' (the REP owes the platform, tracked separately),
 *  'paid' and 'skipped_invalid' (terminal). */
export const COMMISSION_OWED_STATUSES = ['held', 'failed', 'skipped_no_connected_account'] as const
