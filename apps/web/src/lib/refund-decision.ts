// Pure refund/clawback decision logic, extracted from the Stripe webhook so the
// exact rules that caused two money regressions this session are unit-tested
// invariants instead of inline orchestration:
//
//  - A refund of ONE renewal invoice must NOT downgrade a still-billing listing
//    or claw back the whole original sale's commission. Only the ORIGINATING
//    charge does (a payment-intent match, or the subscription's FIRST invoice).
//  - Reversing commission on cancellation is HELD-ONLY: a customer who received
//    the months they paid for keeps the rep's earned commission; only a signup
//    that backed out inside the hold window is reversed.

/**
 * Is the refunded charge the one that ORIGINATED these orders, versus a later
 * renewal that merely shares their subscription? Only the originating charge
 * may drive the tier downgrade and the session-keyed commission clawback.
 */
export function isOriginatingRefund(input: {
  matchedByPaymentIntent: boolean
  invoiceBillingReason?: string | null
}): boolean {
  // A payment-intent match IS, by definition, the exact payment refunded.
  if (input.matchedByPaymentIntent) return true
  // Otherwise only the subscription's first invoice represents the sale.
  return input.invoiceBillingReason === 'subscription_create'
}

/**
 * The directory-listing patch a refund should apply. On a full refund of the
 * originating charge, the paid tier and every pending grant are cleared (a
 * later approval must not re-grant a refunded tier). A renewal refund, or a
 * partial one, leaves the live listing untouched — the customer is still paying.
 */
export function refundListingPatch(input: {
  fullyRefunded: boolean
  isOriginatingCharge: boolean
}): Record<string, unknown> {
  if (input.fullyRefunded && input.isOriginatingCharge) {
    return { tier: 'basic', pending_tier: null, pending_sponsored: null, is_sponsored: false }
  }
  return {}
}

/** Whether a partial (non-full) refund occurred — its commission is NOT
 *  auto-reversed, so callers alert ops instead. */
export function isPartialRefund(input: { fullyRefunded: boolean; amountRefunded: number }): boolean {
  return !input.fullyRefunded && Number(input.amountRefunded) > 0
}
