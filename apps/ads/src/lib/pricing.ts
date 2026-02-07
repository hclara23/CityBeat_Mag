export type AdType = 'newsletter' | 'sponsored' | 'banner'
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'perpost'

export interface BillingOption {
  cycle: BillingCycle
  label: string
  months?: number
  price: number
  savings: number
}

export const NEWSLETTER_OPTIONS: BillingOption[] = [
  { cycle: 'monthly', label: 'Monthly', months: 1, price: 5000, savings: 0 },
  { cycle: 'quarterly', label: 'Quarterly', months: 3, price: 13500, savings: 1500 },
  { cycle: 'yearly', label: 'Yearly', months: 12, price: 50000, savings: 10000 },
]

export const SPONSORED_OPTIONS: BillingOption[] = [
  { cycle: 'monthly', label: 'Monthly', price: 10000, savings: 0 },
  { cycle: 'perpost', label: 'Per Post', price: 3000, savings: 0 },
]

export const BANNER_OPTIONS: BillingOption[] = [
  { cycle: 'monthly', label: 'Monthly', months: 1, price: 2500, savings: 0 },
  { cycle: 'quarterly', label: 'Quarterly', months: 3, price: 6500, savings: 1000 },
  { cycle: 'yearly', label: 'Yearly', months: 12, price: 25000, savings: 5000 },
]

const OPTIONS_BY_AD_TYPE: Record<AdType, BillingOption[]> = {
  newsletter: NEWSLETTER_OPTIONS,
  sponsored: SPONSORED_OPTIONS,
  banner: BANNER_OPTIONS,
}

export function getPricingOptions(adType: AdType): BillingOption[] {
  return OPTIONS_BY_AD_TYPE[adType]
}

export function getPrice(adType: AdType, billingCycle: BillingCycle): number {
  const options = OPTIONS_BY_AD_TYPE[adType]
  const match = options.find(option => option.cycle === billingCycle)
  if (!match) {
    throw new Error('Unsupported billing cycle')
  }
  return match.price
}
