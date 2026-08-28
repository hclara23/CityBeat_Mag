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

export function normalizeDirectoryCategory(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function resolveDirectoryCategory(input: {
  requestedCategory: unknown
  listingCategory?: unknown
}): string {
  return (
    normalizeDirectoryCategory(input.requestedCategory) ||
    normalizeDirectoryCategory(input.listingCategory)
  )
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

export function recurringCustomerParams(input: {
  customerId: unknown
  listingEmail: unknown
  contactEmail: string
}) {
  const customerId = reusableStripeCustomer(input)
  return customerId
    ? {
        customer: customerId,
        customer_update: { address: 'auto' as const, name: 'auto' as const },
      }
    : { customer_email: normalizeSalesEmail(input.contactEmail) }
}

export function recurringCheckoutDefaults(priceLabel: string, interval: 'month' | 'year') {
  return {
    mode: 'subscription' as const,
    payment_method_types: ['card'] as ['card'],
    payment_method_collection: 'always' as const,
    billing_address_collection: 'auto' as const,
    locale: 'auto' as const,
    custom_text: {
      submit: { message: recurringAuthorizationMessage(priceLabel, interval) },
    },
  }
}

export function oneTimeCheckoutDefaults() {
  return {
    mode: 'payment' as const,
    payment_method_types: ['card'] as ['card'],
    billing_address_collection: 'auto' as const,
    locale: 'auto' as const,
  }
}

/**
 * Locations a directory subscription bills for. Multi-location brands are
 * billed PER LOCATION (the ScrapeFlow consolidation writes location_count);
 * every other product — and a net-new single listing — bills exactly one
 * unit. Mirrors the self-serve rule in api/directory/claim so the two
 * checkout paths can never quote different prices for the same listing:
 * before this, a rep selling a 6-location brand charged $19.99/mo where
 * self-serve charged $119.94/mo, and commission shrank by the same factor.
 */
export function directoryBillingQuantity(input: {
  productFamily: string
  billing: string
  listing: Record<string, unknown> | null
}): number {
  if (input.productFamily !== 'directory' || input.billing !== 'subscription') return 1
  const count = Number(input.listing?.location_count)
  return Number.isFinite(count) && count > 1 ? Math.floor(count) : 1
}
