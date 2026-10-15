// Stripe moved an invoice's subscription reference in newer API versions from
// `invoice.subscription` to `invoice.parent.subscription_details.subscription`.
// Keep this resolver dependency-free so every webhook consumer follows the same
// compatibility rule and it remains easy to pin with fixtures from both shapes.

function stripeObjectId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id ? id : null
  }
  return null
}

export function stripeInvoiceSubscriptionId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== 'object') return null
  const value = invoice as {
    subscription?: unknown
    parent?: { subscription_details?: { subscription?: unknown } | null } | null
  }

  // Prefer the legacy top-level field when both are supplied. Stripe should not
  // send conflicting values, but preserving the long-standing source is the
  // least surprising behavior during an API-version transition.
  return (
    stripeObjectId(value.subscription) ||
    stripeObjectId(value.parent?.subscription_details?.subscription)
  )
}
