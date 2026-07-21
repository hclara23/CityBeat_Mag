import Stripe from 'stripe'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@citybeat/lib/firebase/admin'
import {
  REFERRAL_ANNUAL_CAP,
  REFERRAL_MONTHLY_COUPON_ID,
  REFERRAL_QUALIFYING_MONTHS,
  REFERRAL_REWARD_MONTHS,
  addCalendarMonths,
  annualCouponId,
  annualDiscountPercent,
  annualRewardMonthsToApply,
  calendarYearInTimeZone,
  decideReferralQualification,
  isReferralCouponId,
  normalizeReferralCode,
  referralCodeForListing,
  referralCouponFromInvoice,
  referralDiscountAmount,
} from '@/lib/referrals'

type ReferralCodeRecord = {
  code: string
  referrer_listing_id: string
  referrer_owner_id: string
  referrer_subscription_id?: string | null
  status: 'active' | 'inactive'
}

type ReferralBalance = {
  referrer_listing_id: string
  discount_months_remaining: number
  discount_status?: string | null
  active_subscription_id?: string | null
}

function asIso(value: any): string | null {
  if (!value) return null
  if (value?.toDate) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  return null
}

function isPaidListing(listing: any): boolean {
  return Boolean(
    listing?.stripe_subscription_id &&
      (['premium', 'featured'].includes(listing?.tier) ||
        ['premium', 'featured'].includes(listing?.pending_tier) ||
        listing?.claim_status === 'pending_approval')
  )
}

function stripeId(value: any): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id || null
}

export async function ensureReferralProgram(params: {
  listingId: string
  ownerId: string
  subscriptionId?: string | null
}): Promise<string> {
  const code = referralCodeForListing(params.listingId)
  const now = new Date().toISOString()
  const codeRef = adminDb.collection('referral_codes').doc(code)
  const listingRef = adminDb.collection('directory_listings').doc(params.listingId)
  const existingCode = await codeRef.get()
  const batch = adminDb.batch()

  batch.set(
    codeRef,
    {
      code,
      referrer_listing_id: params.listingId,
      referrer_owner_id: params.ownerId,
      referrer_subscription_id: params.subscriptionId || null,
      status: 'active',
      updated_at: now,
      ...(!existingCode.exists ? { created_at: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  )
  batch.set(
    listingRef,
    { referral_code: code, referral_program_updated_at: now },
    { merge: true }
  )
  await batch.commit()
  return code
}

export async function resolveReferralForCheckout(params: {
  code: unknown
  referredListingId: string
  referredOwnerId: string
  referredEmail?: string | null
  referredCustomerId?: string | null
}): Promise<ReferralCodeRecord | null> {
  const record = await resolveReferralLanding(params.code)
  if (!record) return null
  if (
    record.referrer_listing_id === params.referredListingId ||
    record.referrer_owner_id === params.referredOwnerId
  ) {
    return null
  }

  if (params.referredEmail) {
    const referrerProfile = await adminDb
      .collection('profiles')
      .doc(record.referrer_owner_id)
      .get()
    const referrerEmail = String((referrerProfile.data() as any)?.email || '').trim().toLowerCase()
    if (referrerEmail && referrerEmail === params.referredEmail.trim().toLowerCase()) return null
  }
  if (params.referredCustomerId && record.referrer_subscription_id) {
    const referrerSubscription = await adminDb
      .collection('subscriptions')
      .doc(record.referrer_subscription_id)
      .get()
    const referrerCustomerId = String(
      (referrerSubscription.data() as any)?.stripe_customer_id || ''
    )
    if (referrerCustomerId && referrerCustomerId === params.referredCustomerId) return null
  }
  return record
}

export async function resolveReferralLanding(codeValue: unknown): Promise<ReferralCodeRecord | null> {
  const code = normalizeReferralCode(codeValue)
  if (!code) return null

  const codeDoc = await adminDb.collection('referral_codes').doc(code).get()
  if (!codeDoc.exists) return null
  const record = codeDoc.data() as ReferralCodeRecord
  if (
    record.status !== 'active' ||
    !record.referrer_listing_id ||
    !record.referrer_owner_id
  ) {
    return null
  }

  const referrerListingDoc = await adminDb
    .collection('directory_listings')
    .doc(record.referrer_listing_id)
    .get()
  if (!referrerListingDoc.exists) return null
  const listing = referrerListingDoc.data() as any
  if (listing.owner_id !== record.referrer_owner_id || !isPaidListing(listing)) return null

  const subscriptionDoc = await adminDb
    .collection('subscriptions')
    .doc(String(listing.stripe_subscription_id))
    .get()
  if (subscriptionDoc.exists) {
    const status = (subscriptionDoc.data() as any)?.status
    if (!['active', 'trialing'].includes(status)) return null
  }

  return { ...record, code }
}

export async function recordReferralAttribution(params: {
  code: unknown
  referredListingId: string
  referredOwnerId: string
  referredSubscriptionId?: string | null
  referredCustomerId?: string | null
  referredPlan?: string | null
  referredEmail?: string | null
  checkoutCreated?: number | null
}): Promise<boolean> {
  const record = await resolveReferralForCheckout({
    code: params.code,
    referredListingId: params.referredListingId,
    referredOwnerId: params.referredOwnerId,
    referredEmail: params.referredEmail,
    referredCustomerId: params.referredCustomerId,
  })
  if (!record || !params.referredSubscriptionId) return false

  const startedAt = new Date(
    params.checkoutCreated ? params.checkoutCreated * 1000 : Date.now()
  )
  const eligibleAt = addCalendarMonths(startedAt, REFERRAL_QUALIFYING_MONTHS)
  const referralRef = adminDb.collection('referrals').doc(params.referredListingId)
  const listingRef = adminDb.collection('directory_listings').doc(params.referredListingId)

  return adminDb.runTransaction(async (transaction) => {
    const existing = await transaction.get(referralRef)
    if (existing.exists) return false

    const now = new Date().toISOString()
    transaction.create(referralRef, {
      referral_code: record.code,
      referrer_listing_id: record.referrer_listing_id,
      referrer_owner_id: record.referrer_owner_id,
      referred_listing_id: params.referredListingId,
      referred_owner_id: params.referredOwnerId,
      referred_subscription_id: params.referredSubscriptionId,
      referred_customer_id: params.referredCustomerId || null,
      referred_plan: params.referredPlan || null,
      status: 'pending',
      started_at: startedAt.toISOString(),
      eligible_at: eligibleAt.toISOString(),
      created_at: now,
      updated_at: now,
    })
    transaction.set(
      listingRef,
      {
        referred_by_code: record.code,
        referred_by_listing_id: record.referrer_listing_id,
        referral_started_at: startedAt.toISOString(),
      },
      { merge: true }
    )
    return true
  })
}

export async function linkDirectorySubscription(params: {
  subscriptionId?: string | null
  customerId?: string | null
  listingId: string
  ownerId?: string | null
  plan?: string | null
  billingCycle?: string | null
}) {
  if (!params.subscriptionId) return
  await adminDb.collection('subscriptions').doc(params.subscriptionId).set(
    {
      stripe_subscription_id: params.subscriptionId,
      stripe_customer_id: params.customerId || null,
      advertiser_id: params.ownerId || null,
      owner_id: params.ownerId || null,
      listing_id: params.listingId,
      plan_id: params.plan || null,
      billing_cycle: params.billingCycle || null,
      payout_service: 'directory',
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  )
}

export async function getReferralProgramsForOwner(ownerId: string) {
  const listingsSnap = await adminDb
    .collection('directory_listings')
    .where('owner_id', '==', ownerId)
    .get()
  const currentYear = calendarYearInTimeZone(new Date())

  const programs = await Promise.all(
    listingsSnap.docs.map(async (listingDoc) => {
      const listing = listingDoc.data() as any
      if (!isPaidListing(listing)) return null

      const subscriptionId = String(listing.stripe_subscription_id)
      const subscriptionDoc = await adminDb.collection('subscriptions').doc(subscriptionId).get()
      if (
        subscriptionDoc.exists &&
        !['active', 'trialing'].includes((subscriptionDoc.data() as any)?.status)
      ) {
        return null
      }

      const code = await ensureReferralProgram({
        listingId: listingDoc.id,
        ownerId,
        subscriptionId,
      })
      const [referralsSnap, balanceDoc] = await Promise.all([
        adminDb
          .collection('referrals')
          .where('referrer_listing_id', '==', listingDoc.id)
          .get(),
        adminDb.collection('referral_balances').doc(listingDoc.id).get(),
      ])
      const referrals = referralsSnap.docs.map((doc) => doc.data() as any)
      const balance = balanceDoc.exists ? (balanceDoc.data() as ReferralBalance) : null
      const qualifiedThisYear = referrals.filter(
        (referral) =>
          referral.status === 'qualified' && referral.qualification_year === currentYear
      ).length

      return {
        listing_id: listingDoc.id,
        listing_name: listing.name || 'Directory listing',
        plan: listing.plan || null,
        code,
        referral_path: `/refer/${code}`,
        pending_referrals: referrals.filter((referral) => referral.status === 'pending').length,
        qualified_referrals: referrals.filter((referral) => referral.status === 'qualified').length,
        qualified_this_year: qualifiedThisYear,
        annual_cap: REFERRAL_ANNUAL_CAP,
        discount_months_remaining: Math.max(
          0,
          Number(balance?.discount_months_remaining) || 0
        ),
        discount_status: balance?.discount_status || 'none',
      }
    })
  )

  return programs.filter(Boolean)
}

async function ensureCoupon(
  stripe: Stripe,
  id: string,
  params: Stripe.CouponCreateParams
): Promise<Stripe.Coupon> {
  try {
    return await stripe.coupons.retrieve(id)
  } catch (error: any) {
    if (error?.code !== 'resource_missing' && error?.statusCode !== 404) throw error
  }

  try {
    return await stripe.coupons.create({ ...params, id })
  } catch (error: any) {
    // A concurrent cron may have created the deterministic coupon first.
    if (error?.code === 'resource_already_exists' || error?.statusCode === 409) {
      return stripe.coupons.retrieve(id)
    }
    throw error
  }
}

async function setDiscountState(
  listingId: string,
  subscriptionId: string,
  patch: Record<string, any>
) {
  const now = new Date().toISOString()
  const batch = adminDb.batch()
  batch.set(
    adminDb.collection('referral_balances').doc(listingId),
    { ...patch, active_subscription_id: subscriptionId, updated_at: now },
    { merge: true }
  )
  batch.set(
    adminDb.collection('subscriptions').doc(subscriptionId),
    { ...patch, updated_at: now },
    { merge: true }
  )
  await batch.commit()
}

export async function syncReferralDiscountForListing(
  stripe: Stripe,
  listingId: string
): Promise<{ status: string; couponId?: string; discountMonths?: number }> {
  const [listingDoc, balanceDoc] = await Promise.all([
    adminDb.collection('directory_listings').doc(listingId).get(),
    adminDb.collection('referral_balances').doc(listingId).get(),
  ])
  if (!listingDoc.exists || !balanceDoc.exists) return { status: 'missing' }

  const listing = listingDoc.data() as any
  const balance = balanceDoc.data() as ReferralBalance
  const subscriptionId = String(listing.stripe_subscription_id || '')
  if (!subscriptionId) return { status: 'waiting_for_subscription' }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (!['active', 'trialing'].includes(subscription.status)) {
    await setDiscountState(listingId, subscriptionId, {
      discount_status: 'waiting_for_active_subscription',
    })
    return { status: 'waiting_for_active_subscription' }
  }

  const remaining = Math.max(0, Math.floor(Number(balance.discount_months_remaining) || 0))
  const existingCoupon = (subscription as any).discount?.coupon || null
  if (remaining <= 0) {
    if (existingCoupon && isReferralCouponId(existingCoupon.id)) {
      await stripe.subscriptions.deleteDiscount(subscriptionId).catch((error: any) => {
        if (error?.code !== 'resource_missing' && error?.statusCode !== 404) throw error
      })
    }
    await setDiscountState(listingId, subscriptionId, {
      discount_status: 'none',
      referral_discount_coupon_id: null,
      referral_discount_months_applied: 0,
      referral_discount_percent: 0,
    })
    return { status: 'none', discountMonths: 0 }
  }

  if (existingCoupon && !isReferralCouponId(existingCoupon.id)) {
    await setDiscountState(listingId, subscriptionId, {
      discount_status: 'blocked_existing_discount',
      blocked_coupon_id: existingCoupon.id,
    })
    return { status: 'blocked_existing_discount' }
  }

  const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month'
  let coupon: Stripe.Coupon
  let rewardMonths: number
  let percent: number

  if (interval === 'year') {
    rewardMonths = annualRewardMonthsToApply(remaining)
    percent = annualDiscountPercent(rewardMonths)
    const couponId = annualCouponId(rewardMonths)
    coupon = await ensureCoupon(stripe, couponId, {
      duration: 'once',
      percent_off: percent,
      name: `CityBeat referral reward (${percent}% off annual renewal)`,
      metadata: {
        citybeat_referral: 'true',
        reward_mode: 'year',
        reward_months: String(rewardMonths),
      },
    })
  } else {
    rewardMonths = 1
    percent = 25
    coupon = await ensureCoupon(stripe, REFERRAL_MONTHLY_COUPON_ID, {
      duration: 'forever',
      percent_off: 25,
      name: 'CityBeat referral reward (25% off)',
      metadata: {
        citybeat_referral: 'true',
        reward_mode: 'month',
        reward_months: '1',
      },
    })
  }

  if (existingCoupon?.id !== coupon.id) {
    await stripe.subscriptions.update(subscriptionId, {
      coupon: coupon.id,
      proration_behavior: 'none',
    })
  }

  await setDiscountState(listingId, subscriptionId, {
    discount_status: 'active',
    blocked_coupon_id: null,
    referral_discount_coupon_id: coupon.id,
    referral_discount_months_applied: rewardMonths,
    referral_discount_percent: percent,
  })
  return { status: 'active', couponId: coupon.id, discountMonths: rewardMonths }
}

async function creditRewardBalance(referralId: string): Promise<string | null> {
  const rewardRef = adminDb.collection('referral_rewards').doc(referralId)
  return adminDb.runTransaction(async (transaction) => {
    const rewardDoc = await transaction.get(rewardRef)
    if (!rewardDoc.exists) return null
    const reward = rewardDoc.data() as any
    if (reward.status === 'credited') return reward.referrer_listing_id || null

    const listingId = String(reward.referrer_listing_id || '')
    if (!listingId) return null
    const balanceRef = adminDb.collection('referral_balances').doc(listingId)
    const balanceDoc = await transaction.get(balanceRef)
    const current = balanceDoc.exists
      ? Number((balanceDoc.data() as any)?.discount_months_remaining) || 0
      : 0
    const now = new Date().toISOString()

    transaction.set(
      balanceRef,
      {
        referrer_listing_id: listingId,
        discount_months_remaining: current + REFERRAL_REWARD_MONTHS,
        discount_status: 'pending_application',
        updated_at: now,
      },
      { merge: true }
    )
    transaction.set(
      rewardRef,
      { status: 'credited', credited_at: now, updated_at: now },
      { merge: true }
    )
    return listingId
  })
}

async function qualifyReferral(
  stripe: Stripe,
  referralId: string,
  now: Date
): Promise<string> {
  const referralRef = adminDb.collection('referrals').doc(referralId)
  const referralDoc = await referralRef.get()
  if (!referralDoc.exists) return 'missing'
  const initial = referralDoc.data() as any
  if (initial.status !== 'pending') return initial.status || 'ignored'
  if (new Date(initial.eligible_at) > now) return 'not_due'

  let subscriptionStatus = 'canceled'
  try {
    const subscription = await stripe.subscriptions.retrieve(
      String(initial.referred_subscription_id)
    )
    subscriptionStatus = subscription.status
  } catch (error: any) {
    if (error?.code !== 'resource_missing' && error?.statusCode !== 404) throw error
  }

  const year = calendarYearInTimeZone(now)
  const yearRef = adminDb
    .collection('referral_years')
    .doc(`${initial.referrer_listing_id}_${year}`)
  const rewardRef = adminDb.collection('referral_rewards').doc(referralId)

  const outcome = await adminDb.runTransaction(async (transaction) => {
    const [freshReferral, yearDoc] = await Promise.all([
      transaction.get(referralRef),
      transaction.get(yearRef),
    ])
    if (!freshReferral.exists) return 'missing'
    const referral = freshReferral.data() as any
    if (referral.status !== 'pending') return referral.status || 'ignored'

    const qualifiedCount = yearDoc.exists
      ? Number((yearDoc.data() as any)?.qualified_count) || 0
      : 0
    const decision = decideReferralQualification({
      eligibleAt: referral.eligible_at,
      now,
      subscriptionStatus,
      qualifiedCount,
      refunded: Boolean(referral.refunded_at),
    })
    const updatedAt = now.toISOString()

    if (decision.action === 'wait') return decision.reason
    if (decision.action === 'disqualify') {
      transaction.set(
        referralRef,
        { status: 'disqualified', disqualified_reason: decision.reason, updated_at: updatedAt },
        { merge: true }
      )
      return 'disqualified'
    }
    if (decision.action === 'cap') {
      transaction.set(
        referralRef,
        { status: 'capped', capped_year: year, updated_at: updatedAt },
        { merge: true }
      )
      return 'capped'
    }

    transaction.set(
      yearRef,
      {
        referrer_listing_id: referral.referrer_listing_id,
        year,
        qualified_count: qualifiedCount + 1,
        updated_at: updatedAt,
      },
      { merge: true }
    )
    transaction.set(
      referralRef,
      {
        status: 'qualified',
        qualification_year: decision.qualificationYear,
        qualified_at: updatedAt,
        reward_id: referralId,
        reward_months: REFERRAL_REWARD_MONTHS,
        updated_at: updatedAt,
      },
      { merge: true }
    )
    transaction.set(
      rewardRef,
      {
        referral_id: referralId,
        referrer_listing_id: referral.referrer_listing_id,
        referred_listing_id: referral.referred_listing_id,
        discount_months: REFERRAL_REWARD_MONTHS,
        status: 'pending',
        created_at: updatedAt,
        updated_at: updatedAt,
      },
      { merge: true }
    )
    return 'qualified'
  })

  if (outcome === 'qualified') {
    const listingId = await creditRewardBalance(referralId)
    if (listingId) await syncReferralDiscountForListing(stripe, listingId)
  }
  return outcome
}

async function retryPendingRewards(stripe: Stripe): Promise<number> {
  const pendingRewards = await adminDb
    .collection('referral_rewards')
    .where('status', '==', 'pending')
    .get()
  let credited = 0
  for (const rewardDoc of pendingRewards.docs) {
    const listingId = await creditRewardBalance(rewardDoc.id)
    if (listingId) {
      credited += 1
      await syncReferralDiscountForListing(stripe, listingId)
    }
  }
  return credited
}

async function syncOutstandingBalances(stripe: Stripe): Promise<number> {
  const balances = await adminDb.collection('referral_balances').get()
  let synced = 0
  for (const balanceDoc of balances.docs) {
    const balance = balanceDoc.data() as ReferralBalance
    const remaining = Number(balance.discount_months_remaining) || 0
    if (remaining <= 0 && !['active', 'consumed'].includes(balance.discount_status || '')) continue
    await syncReferralDiscountForListing(stripe, balanceDoc.id)
    synced += 1
  }
  return synced
}

export async function runReferralQualification(params: {
  stripe: Stripe
  now?: Date
  limit?: number
  dryRun?: boolean
}) {
  const now = params.now || new Date()
  const limit = Math.max(1, Math.min(500, params.limit || 200))
  const pendingSnap = await adminDb
    .collection('referrals')
    .where('status', '==', 'pending')
    .get()
  const due = pendingSnap.docs
    .filter((doc) => {
      const eligibleAt = asIso((doc.data() as any)?.eligible_at)
      return Boolean(eligibleAt && new Date(eligibleAt!) <= now)
    })
    .slice(0, limit)

  if (params.dryRun) {
    return { dry_run: true, pending: pendingSnap.size, due: due.length }
  }

  const results: Record<string, number> = {}
  for (const referralDoc of due) {
    const outcome = await qualifyReferral(params.stripe, referralDoc.id, now)
    results[outcome] = (results[outcome] || 0) + 1
  }
  const retriedRewards = await retryPendingRewards(params.stripe)
  const syncedBalances = await syncOutstandingBalances(params.stripe)
  return {
    dry_run: false,
    pending: pendingSnap.size,
    due: due.length,
    results,
    retried_rewards: retriedRewards,
    synced_balances: syncedBalances,
  }
}

export async function consumeReferralRewardForInvoice(
  stripe: Stripe,
  invoice: any
): Promise<{ consumed: number; remaining: number } | null> {
  const coupon = referralCouponFromInvoice(invoice)
  const discountAmount = referralDiscountAmount(invoice)
  const subscriptionId = stripeId(invoice.subscription)
  if (!coupon || discountAmount <= 0 || !subscriptionId) return null

  const subscriptionDoc = await adminDb.collection('subscriptions').doc(subscriptionId).get()
  let listingId = subscriptionDoc.exists
    ? String((subscriptionDoc.data() as any)?.listing_id || '')
    : ''
  if (!listingId) {
    const listingSnap = await adminDb
      .collection('directory_listings')
      .where('stripe_subscription_id', '==', subscriptionId)
      .limit(1)
      .get()
    listingId = listingSnap.empty ? '' : listingSnap.docs[0].id
  }
  if (!listingId) return null

  const usageRef = adminDb.collection('referral_invoice_usage').doc(String(invoice.id))
  const balanceRef = adminDb.collection('referral_balances').doc(listingId)
  const result = await adminDb.runTransaction(async (transaction) => {
    const [usageDoc, balanceDoc] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(balanceRef),
    ])
    if (usageDoc.exists) {
      const usage = usageDoc.data() as any
      return { consumed: Number(usage.discount_months) || 0, remaining: Number(usage.remaining) || 0, duplicate: true }
    }
    if (!balanceDoc.exists) return null

    const current = Math.max(
      0,
      Math.floor(Number((balanceDoc.data() as any)?.discount_months_remaining) || 0)
    )
    const consumed = Math.min(current, coupon.rewardMonths)
    if (consumed <= 0) return null
    const remaining = current - consumed
    const now = new Date().toISOString()
    transaction.set(
      balanceRef,
      {
        discount_months_remaining: remaining,
        discount_status: remaining > 0 ? 'active' : 'consumed',
        last_consumed_invoice_id: invoice.id,
        last_consumed_at: now,
        updated_at: now,
      },
      { merge: true }
    )
    transaction.create(usageRef, {
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscriptionId,
      referrer_listing_id: listingId,
      coupon_id: coupon.id,
      discount_months: consumed,
      discount_amount: discountAmount,
      remaining,
      created_at: now,
    })
    return { consumed, remaining, duplicate: false }
  })

  if (!result) return null
  // Always resynchronize, including webhook retries. If Stripe succeeded but the
  // first attempt failed before clearing the coupon/state, the retry repairs it.
  await syncReferralDiscountForListing(stripe, listingId)
  return { consumed: result.consumed, remaining: result.remaining }
}

export async function disqualifyPendingReferralForListing(
  listingId: string,
  reason: 'canceled' | 'refunded'
) {
  const referralRef = adminDb.collection('referrals').doc(listingId)
  const referralDoc = await referralRef.get()
  if (!referralDoc.exists || (referralDoc.data() as any)?.status !== 'pending') return
  await referralRef.set(
    {
      status: 'disqualified',
      disqualified_reason: reason,
      ...(reason === 'refunded' ? { refunded_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  )
}
