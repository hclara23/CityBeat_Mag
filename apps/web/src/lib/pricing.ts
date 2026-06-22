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
export type PlanId = 'founding' | 'premium_monthly' | 'premium_annual' | 'featured_monthly'

export interface DirectoryPlan {
  id: PlanId
  tier: Exclude<ListingTier, 'basic'>
  interval: 'month' | 'year'
  unitAmount: number // in cents
  label: string
  priceLabel: string
  description: string
  founding?: boolean
}

export const FOUNDING_LIMIT = 100

export const DIRECTORY_PLANS: Record<PlanId, DirectoryPlan> = {
  founding: {
    id: 'founding',
    tier: 'premium',
    interval: 'month',
    unitAmount: 999,
    label: 'Founding Member',
    priceLabel: '$9.99 / mo',
    description:
      'Founding 100 launch price — locked in for life. All Premium features: photo gallery, cover image, social links, hours, and priority placement.',
    founding: true,
  },
  premium_monthly: {
    id: 'premium_monthly',
    tier: 'premium',
    interval: 'month',
    unitAmount: 1999,
    label: 'Premium (Monthly)',
    priceLabel: '$19.99 / mo',
    description:
      'Premium listing: photo gallery, cover image, custom description, social links, day-by-day hours, and priority search placement.',
  },
  premium_annual: {
    id: 'premium_annual',
    tier: 'premium',
    interval: 'year',
    unitAmount: 19900,
    label: 'Premium (Annual)',
    priceLabel: '$199 / yr',
    description:
      'All Premium features billed yearly — two months free vs. monthly. Photo gallery, cover image, social links, hours, and priority placement.',
  },
  featured_monthly: {
    id: 'featured_monthly',
    tier: 'featured',
    interval: 'month',
    unitAmount: 4900,
    label: 'Featured (Monthly)',
    priceLabel: '$49 / mo',
    description:
      'Everything in Premium plus top-of-category Featured placement, a Featured badge, and homepage rotation for maximum visibility.',
  },
}

export function getPlan(id: string | undefined | null): DirectoryPlan | null {
  if (!id) return null
  return (DIRECTORY_PLANS as Record<string, DirectoryPlan>)[id] || null
}
