// Directory subscription plans. One source of truth for the checkout route,
// the Stripe webhook (tier mapping), and the claim UI.
//
// Tiers:
//   premium  — full listing (gallery, cover, social, hours, priority placement)
//   featured — premium + top-of-category "Featured" placement & badge
//
// Founding 100 is a launch promo: the first 100 paid claimers lock in $9.99/mo
// for the life of their subscription (Stripe keeps the price fixed once created).

export type ListingTier = 'basic' | 'premium' | 'featured'
export type PlanId =
  | 'founding_annual'
  | 'founding'
  | 'premium_annual'
  | 'premium_monthly'
  | 'featured_monthly'

export interface DirectoryPlan {
  id: PlanId
  tier: Exclude<ListingTier, 'basic'>
  interval: 'month' | 'year'
  unitAmount: number // in cents
  label: string
  priceLabel: string
  description: string
  founding?: boolean
  badge?: string // e.g. "Best value" — highlighted in the plan picker
  savingsLabel?: string // e.g. "2 months free vs monthly"
  effectiveMonthly?: string // annual plans: the per-month equivalent, for anchoring
}

export const FOUNDING_LIMIT = 100

// Order here is the order shown in the picker — annual/best-value FIRST.
export const DIRECTORY_PLANS: Record<PlanId, DirectoryPlan> = {
  founding_annual: {
    id: 'founding_annual',
    tier: 'premium',
    interval: 'year',
    unitAmount: 9900, // $99/yr — founding discount + annual commitment, locked for life
    label: 'Founding Annual',
    priceLabel: '$99 / yr',
    effectiveMonthly: '$8.25/mo',
    badge: 'Best value · 100 only',
    savingsLabel: 'Lock in $99/yr for life — save $140 vs monthly',
    description:
      'The Founding 100 launch deal: all Premium features at the lowest price we will ever offer, locked in for the life of your subscription. Photo gallery, cover image, social links, hours, and priority placement.',
    founding: true,
  },
  founding: {
    id: 'founding',
    tier: 'premium',
    interval: 'month',
    unitAmount: 999,
    label: 'Founding Monthly',
    priceLabel: '$9.99 / mo',
    badge: 'Launch · 100 only',
    description:
      'Founding 100 launch price — locked in for life. All Premium features: photo gallery, cover image, social links, hours, and priority placement.',
    founding: true,
  },
  premium_annual: {
    id: 'premium_annual',
    tier: 'premium',
    interval: 'year',
    unitAmount: 19900,
    label: 'Premium Annual',
    priceLabel: '$199 / yr',
    effectiveMonthly: '$16.58/mo',
    savingsLabel: '2 months free vs monthly',
    description:
      'All Premium features billed yearly — two months free vs. monthly. Photo gallery, cover image, social links, hours, and priority placement.',
  },
  premium_monthly: {
    id: 'premium_monthly',
    tier: 'premium',
    interval: 'month',
    unitAmount: 1999,
    label: 'Premium Monthly',
    priceLabel: '$19.99 / mo',
    description:
      'Premium listing: photo gallery, cover image, custom description, social links, day-by-day hours, and priority search placement.',
  },
  featured_monthly: {
    id: 'featured_monthly',
    tier: 'featured',
    interval: 'month',
    unitAmount: 4900,
    label: 'Featured',
    priceLabel: '$49 / mo',
    badge: 'Top spot',
    description:
      'Everything in Premium plus top-of-category Featured placement, a Featured badge, and homepage rotation for maximum visibility.',
  },
}

export function getPlan(id: string | undefined | null): DirectoryPlan | null {
  if (!id) return null
  return (DIRECTORY_PLANS as Record<string, DirectoryPlan>)[id] || null
}
