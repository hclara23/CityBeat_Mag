export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300

type RefundCharge = {
  id?: string | null
  amount?: number | null
  payment_intent?: string | null
}

export function isStripeTimestampFresh(
  timestamp: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = STRIPE_WEBHOOK_TOLERANCE_SECONDS
) {
  const parsed = Number(timestamp)
  if (!Number.isFinite(parsed)) return false

  return Math.abs(nowSeconds - parsed) <= toleranceSeconds
}

function encodeFilterValue(value: string) {
  return encodeURIComponent(value)
}

export function buildRefundPurchaseQuery(charge: RefundCharge) {
  const exactFilters: string[] = []

  if (charge.id) {
    exactFilters.push(`stripe_charge_id.eq.${encodeFilterValue(charge.id)}`)
  }
  if (charge.payment_intent) {
    exactFilters.push(`stripe_payment_intent_id.eq.${encodeFilterValue(charge.payment_intent)}`)
  }

  if (exactFilters.length === 0) {
    return 'payment_status=eq.completed&id=eq.__no_exact_stripe_identifier__'
  }

  return `payment_status=eq.completed&or=(${exactFilters.join(',')})`
}
