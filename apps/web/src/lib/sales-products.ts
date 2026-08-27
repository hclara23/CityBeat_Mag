import { DIRECTORY_PLANS, type PlanId } from './pricing'

export type SalesProductId =
  | 'directory_basic_free'
  | 'directory_founding_annual'
  | 'directory_founding_monthly'
  | 'directory_premium_annual'
  | 'directory_premium_monthly'
  | 'directory_featured_monthly'
  | 'directory_sponsored_monthly'
  | 'ad_newsletter_sponsorship'
  | 'ad_sponsored_story'
  | 'ad_category_banner'
  | 'event_featured'
  | 'job_posting_30_day'
  | 'custom_one_time'

export type SalesProductFamily = 'directory' | 'advertising' | 'events' | 'jobs' | 'custom'
export type SalesBillingKind = 'free' | 'subscription' | 'one_time'
export type SalesIntakeKind =
  | 'directory'
  | 'newsletter_sponsorship'
  | 'sponsored_story'
  | 'category_banner'
  | 'event'
  | 'job'
  | 'custom'

export interface SalesProduct {
  id: SalesProductId
  family: SalesProductFamily
  intakeKind: SalesIntakeKind
  name: string
  shortName: string
  description: string
  salesAngle: string
  billing: SalesBillingKind
  interval: 'month' | 'year' | null
  unitAmount: number | null
  priceLabel: string
  directoryPlanId?: PlanId
  founding?: boolean
  sponsored?: boolean
}

function directoryProduct(
  id: SalesProductId,
  planId: PlanId,
  shortName: string,
  salesAngle: string
): SalesProduct {
  const plan = DIRECTORY_PLANS[planId]
  return {
    id,
    family: 'directory',
    intakeKind: 'directory',
    name: `Directory - ${plan.label}`,
    shortName,
    description: plan.description,
    salesAngle,
    billing: 'subscription',
    interval: plan.interval,
    unitAmount: plan.unitAmount,
    priceLabel: plan.priceLabel,
    directoryPlanId: planId,
    founding: Boolean(plan.founding),
    sponsored: Boolean(plan.sponsored),
  }
}

export const SALES_PRODUCTS: Record<SalesProductId, SalesProduct> = {
  directory_basic_free: {
    id: 'directory_basic_free',
    family: 'directory',
    intakeKind: 'directory',
    name: 'Directory - Basic Free',
    shortName: 'Basic Free',
    description: 'A public, claimable CityBeat directory listing with no payment or recurring charge.',
    salesAngle: 'Give every local business a credible CityBeat presence now, with a clear path to upgrade later.',
    billing: 'free',
    interval: null,
    unitAmount: 0,
    priceLabel: 'Free',
  },
  directory_founding_annual: directoryProduct(
    'directory_founding_annual',
    'founding_annual',
    'Founding Annual',
    'Lowest long-term rate with premium visibility, locked for the life of the subscription.'
  ),
  directory_founding_monthly: directoryProduct(
    'directory_founding_monthly',
    'founding',
    'Founding Monthly',
    'An accessible monthly entry to premium visibility with the launch price locked in.'
  ),
  directory_premium_annual: directoryProduct(
    'directory_premium_annual',
    'premium_annual',
    'Premium Annual',
    'A full business presence with the strongest standard annual value.'
  ),
  directory_premium_monthly: directoryProduct(
    'directory_premium_monthly',
    'premium_monthly',
    'Premium Monthly',
    'A flexible way to add photos, hours, links, and priority directory placement.'
  ),
  directory_featured_monthly: directoryProduct(
    'directory_featured_monthly',
    'featured_monthly',
    'Featured Monthly',
    'Top-of-category visibility for businesses that need to stand out immediately.'
  ),
  directory_sponsored_monthly: directoryProduct(
    'directory_sponsored_monthly',
    'sponsored_monthly',
    'Sponsored',
    'The most prominent placement on the site — a rotating spot in the Sponsored Listings grid at the top of the whole directory.'
  ),
  ad_newsletter_sponsorship: {
    id: 'ad_newsletter_sponsorship',
    family: 'advertising',
    intakeKind: 'newsletter_sponsorship',
    name: 'Advertising - Newsletter Sponsorship',
    shortName: 'Newsletter Sponsorship',
    description: 'Recurring sponsorship placement in CityBeat email newsletters.',
    salesAngle: 'Repeated exposure in a high-attention inbox placement keeps the brand familiar.',
    billing: 'subscription',
    interval: 'month',
    unitAmount: 5000,
    priceLabel: '$50 / mo',
  },
  ad_sponsored_story: {
    id: 'ad_sponsored_story',
    family: 'advertising',
    intakeKind: 'sponsored_story',
    name: 'Advertising - Sponsored Story',
    shortName: 'Sponsored Story',
    description: 'One sponsored editorial-style story prepared from the customer brief.',
    salesAngle: 'More room than a display ad to explain a product, opening, mission, or offer.',
    billing: 'one_time',
    interval: null,
    unitAmount: 3000,
    priceLabel: '$30 once',
  },
  ad_category_banner: {
    id: 'ad_category_banner',
    family: 'advertising',
    intakeKind: 'category_banner',
    name: 'Advertising - Category Banner',
    shortName: 'Category Banner',
    description: 'Recurring banner placement alongside a relevant CityBeat category.',
    salesAngle: 'Places the offer in front of readers while they are already exploring the category.',
    billing: 'subscription',
    interval: 'month',
    unitAmount: 2500,
    priceLabel: '$25 / mo',
  },
  event_featured: {
    id: 'event_featured',
    family: 'events',
    intakeKind: 'event',
    name: 'Events - Featured Event',
    shortName: 'Featured Event',
    description: 'One enhanced event listing with featured placement.',
    salesAngle: 'Adds urgency and visibility while readers are deciding what to do locally.',
    billing: 'one_time',
    interval: null,
    unitAmount: 2500,
    priceLabel: '$25 once',
  },
  job_posting_30_day: {
    id: 'job_posting_30_day',
    family: 'jobs',
    intakeKind: 'job',
    name: 'Jobs - 30-Day Job Posting',
    shortName: '30-Day Job Posting',
    description: 'One local job listing published for 30 days.',
    salesAngle: 'Reaches local candidates with a complete role and compensation profile.',
    billing: 'one_time',
    interval: null,
    unitAmount: 5000,
    priceLabel: '$50 once',
  },
  custom_one_time: {
    id: 'custom_one_time',
    family: 'custom',
    intakeKind: 'custom',
    name: 'Custom - Manager-Approved Quote',
    shortName: 'Custom One-Time Quote',
    description: 'A manager-approved one-time CityBeat product or promotion.',
    salesAngle: 'Keeps an approved custom package in the same payment and fulfillment workflow.',
    billing: 'one_time',
    interval: null,
    unitAmount: null,
    priceLabel: 'Custom amount',
  },
}

export const SALES_PRODUCT_ORDER: SalesProductId[] = [
  'directory_basic_free',
  'directory_founding_annual',
  'directory_founding_monthly',
  'directory_premium_annual',
  'directory_premium_monthly',
  'directory_featured_monthly',
  'directory_sponsored_monthly',
  'ad_newsletter_sponsorship',
  'ad_sponsored_story',
  'ad_category_banner',
  'event_featured',
  'job_posting_30_day',
  'custom_one_time',
]

export const SALES_PRODUCT_GROUPS: Array<{
  family: SalesProductFamily
  label: string
  products: SalesProductId[]
}> = [
  { family: 'directory', label: 'Directory', products: SALES_PRODUCT_ORDER.filter((id) => SALES_PRODUCTS[id].family === 'directory') },
  { family: 'advertising', label: 'Advertising', products: SALES_PRODUCT_ORDER.filter((id) => SALES_PRODUCTS[id].family === 'advertising') },
  { family: 'events', label: 'Events', products: ['event_featured'] },
  { family: 'jobs', label: 'Jobs', products: ['job_posting_30_day'] },
  { family: 'custom', label: 'Custom', products: ['custom_one_time'] },
]

export function getSalesProduct(value: unknown): SalesProduct | null {
  if (typeof value !== 'string') return null
  return (SALES_PRODUCTS as Record<string, SalesProduct>)[value] || null
}

export function legacySalesProductId(kind: unknown, plan: unknown): SalesProductId {
  if (kind === 'custom') return 'custom_one_time'
  const byPlan: Record<string, SalesProductId> = {
    founding_annual: 'directory_founding_annual',
    founding: 'directory_founding_monthly',
    premium_annual: 'directory_premium_annual',
    premium_monthly: 'directory_premium_monthly',
    featured_monthly: 'directory_featured_monthly',
  }
  return typeof plan === 'string' && byPlan[plan] ? byPlan[plan] : 'directory_premium_monthly'
}

export function resolveSalesProductRequest(input: {
  productId?: unknown
  kind?: unknown
  plan?: unknown
}): SalesProduct | null {
  if (input.productId !== undefined && input.productId !== null && input.productId !== '') {
    return getSalesProduct(input.productId)
  }
  const hasLegacySelection = input.kind === 'directory' || input.kind === 'custom' || typeof input.plan === 'string'
  return hasLegacySelection ? getSalesProduct(legacySalesProductId(input.kind, input.plan)) : null
}

export function salesProductAmount(product: SalesProduct, customDollars: unknown): number | null {
  if (product.unitAmount !== null) return product.unitAmount
  const dollars = Number(customDollars)
  if (!Number.isFinite(dollars) || dollars < 1 || dollars > 100000) return null
  return Math.round(dollars * 100)
}

export function salesProductPriceLabel(product: SalesProduct, amount: number): string {
  if (product.unitAmount !== null) return product.priceLabel
  return `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)} once`
}
