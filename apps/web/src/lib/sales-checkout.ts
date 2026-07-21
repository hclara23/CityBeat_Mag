export type SalesCheckoutKind = 'directory' | 'custom'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]+$/
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(['canceled', 'incomplete_expired'])

export function salesCheckoutKind(value: unknown): SalesCheckoutKind {
  return value === 'custom' ? 'custom' : 'directory'
}

export function normalizeSalesEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isValidSalesEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value)
}

export function recurringEmailError(kind: SalesCheckoutKind, email: string): string | null {
  if (kind !== 'directory') return null
  if (!email) return 'Client email is required for recurring billing'
  if (!isValidSalesEmail(email)) return 'Enter a valid client email for recurring billing'
  return null
}

/**
 * Stripe subscriptions can still collect or retry payment in every state except
 * the two terminal states below. Starting another subscription would risk a
 * duplicate charge, so the customer should update the existing one instead.
 */
export function blocksReplacementSubscription(status: unknown): boolean {
  if (typeof status !== 'string' || !status) return true
  return !TERMINAL_SUBSCRIPTION_STATUSES.has(status)
}

export function reusableStripeCustomer(input: {
  customerId: unknown
  listingEmail: unknown
  contactEmail: string
}): string | null {
  const customerId = typeof input.customerId === 'string' ? input.customerId.trim() : ''
  if (!STRIPE_CUSTOMER_PATTERN.test(customerId)) return null

  const listingEmail = normalizeSalesEmail(input.listingEmail)
  if (!listingEmail || listingEmail !== normalizeSalesEmail(input.contactEmail)) return null
  return customerId
}

export function recurringAuthorizationMessage(priceLabel: string, interval: 'month' | 'year'): string {
  const cadence = interval === 'year' ? 'each year' : 'each month'
  return `By subscribing, you authorize CityBeat to charge this payment method ${priceLabel} ${cadence} until canceled.`
}
