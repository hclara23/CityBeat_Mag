import { createHash } from 'node:crypto'

export const REFERRAL_COOKIE = 'citybeat_directory_referral'
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
export const REFERRAL_QUALIFYING_MONTHS = 3
export const REFERRAL_REWARD_MONTHS = 3
export const REFERRAL_ANNUAL_CAP = 16
export const REFERRAL_MONTHLY_COUPON_ID = 'citybeat_referral_monthly_25'
export const REFERRAL_ANNUAL_COUPON_PREFIX = 'citybeat_referral_annual_'

export type ReferralStatus = 'pending' | 'qualified' | 'capped' | 'disqualified'

export type ReferralQualificationDecision =
  | { action: 'wait'; reason: 'not_due' | 'past_due' }
  | { action: 'disqualify'; reason: 'canceled' | 'refunded' }
  | { action: 'cap'; reason: 'annual_cap' }
  | { action: 'qualify'; qualificationYear: number }

export function referralCodeForListing(listingId: string): string {
  return createHash('sha256')
    .update(`citybeat-directory-referral:${listingId}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()
}

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return /^[A-F0-9]{12}$/.test(normalized) ? normalized : null
}

// Adds calendar months without JavaScript's Jan 31 -> Mar 2 overflow behavior.
export function addCalendarMonths(value: Date | string, months: number): Date {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid referral date')

  const day = date.getUTCDate()
  const result = new Date(date.getTime())
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

export function calendarYearInTimeZone(
  value: Date | string,
  timeZone = 'America/Denver'
): number {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid referral date')
  return Number(
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(date)
  )
}

export function annualDiscountPercent(discountMonths: number): number {
  const monthsApplied = Math.max(0, Math.min(48, Math.floor(discountMonths)))
  return Number(((monthsApplied * 25) / 12).toFixed(2))
}

export function annualRewardMonthsToApply(discountMonths: number): number {
  return Math.max(0, Math.min(48, Math.floor(discountMonths)))
}

export function annualCouponId(discountMonths: number): string {
  const months = annualRewardMonthsToApply(discountMonths)
  return `${REFERRAL_ANNUAL_COUPON_PREFIX}${String(months).padStart(2, '0')}`
}

export function isReferralCouponId(value: unknown): boolean {
  return (
    value === REFERRAL_MONTHLY_COUPON_ID ||
    (typeof value === 'string' && value.startsWith(REFERRAL_ANNUAL_COUPON_PREFIX))
  )
}

export function referralDiscountAmount(invoice: {
  total_discount_amounts?: Array<{ amount?: number | null }> | null
}): number {
  return (invoice.total_discount_amounts || []).reduce(
    (total, item) => total + Math.max(0, Number(item?.amount) || 0),
    0
  )
}

export function referralCouponFromInvoice(invoice: any): {
  id: string
  rewardMonths: number
  mode: 'month' | 'year'
} | null {
  const discounts = [
    invoice?.discount,
    ...(Array.isArray(invoice?.discounts) ? invoice.discounts : []),
    ...(Array.isArray(invoice?.total_discount_amounts)
      ? invoice.total_discount_amounts.map((item: any) => item?.discount)
      : []),
  ]

  for (const discount of discounts) {
    if (!discount || typeof discount === 'string') continue
    const coupon = discount.coupon
    if (!coupon || !isReferralCouponId(coupon.id)) continue
    const rewardMonths = Math.max(1, Number(coupon.metadata?.reward_months) || 1)
    return {
      id: coupon.id,
      rewardMonths,
      mode: coupon.metadata?.reward_mode === 'year' ? 'year' : 'month',
    }
  }

  return null
}

export function decideReferralQualification(input: {
  eligibleAt: Date | string
  now: Date | string
  subscriptionStatus: string
  qualifiedCount: number
  refunded?: boolean
}): ReferralQualificationDecision {
  const eligibleAt = new Date(input.eligibleAt)
  const now = new Date(input.now)
  if (!Number.isFinite(eligibleAt.getTime()) || !Number.isFinite(now.getTime())) {
    throw new Error('Invalid referral qualification date')
  }

  if (input.refunded) return { action: 'disqualify', reason: 'refunded' }
  if (['canceled', 'incomplete_expired', 'unpaid'].includes(input.subscriptionStatus)) {
    return { action: 'disqualify', reason: 'canceled' }
  }
  if (now < eligibleAt) return { action: 'wait', reason: 'not_due' }
  if (!['active', 'trialing'].includes(input.subscriptionStatus)) {
    return { action: 'wait', reason: 'past_due' }
  }
  if (input.qualifiedCount >= REFERRAL_ANNUAL_CAP) {
    return { action: 'cap', reason: 'annual_cap' }
  }

  return {
    action: 'qualify',
    qualificationYear: calendarYearInTimeZone(now),
  }
}
