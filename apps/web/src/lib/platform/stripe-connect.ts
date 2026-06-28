import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'

// Firestore-backed Stripe Connect data layer.
// Connected-account records live in the `stripe_connected_accounts` collection,
// keyed by the user's profile id (Firebase uid). A summary is also mirrored onto
// the user's `profiles/{uid}` doc for quick reads.

export type ConnectAccountRecord = {
  profile_id: string
  stripe_account_id: string
  account_type: string
  country: string
  default_currency: string
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  onboarding_complete: boolean
  requirements_currently_due: string[]
  requirements_past_due: string[]
  metadata: Record<string, unknown>
  updated_at: string
}

const COLLECTION = 'stripe_connected_accounts'

export function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('Stripe configuration missing')
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2023-08-16',
  })
}

export async function syncConnectedAccount(
  profileId: string,
  account: Stripe.Account
): Promise<ConnectAccountRecord> {
  const onboardingComplete = Boolean(account.details_submitted && account.payouts_enabled)

  const record: ConnectAccountRecord = {
    profile_id: profileId,
    stripe_account_id: account.id,
    account_type: account.type || 'express',
    country: account.country || 'US',
    default_currency: account.default_currency || 'usd',
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    details_submitted: Boolean(account.details_submitted),
    onboarding_complete: onboardingComplete,
    requirements_currently_due: account.requirements?.currently_due ?? [],
    requirements_past_due: account.requirements?.past_due ?? [],
    metadata: (account.metadata as Record<string, unknown>) || {},
    updated_at: new Date().toISOString(),
  }

  await adminDb.collection(COLLECTION).doc(profileId).set(record, { merge: true })

  await adminDb
    .collection('profiles')
    .doc(profileId)
    .set(
      {
        stripe_connected_account_id: account.id,
        stripe_connect_onboarding_complete: onboardingComplete,
      },
      { merge: true }
    )

  return record
}

export async function getExistingConnectedAccount(
  profileId: string
): Promise<ConnectAccountRecord | null> {
  const doc = await adminDb.collection(COLLECTION).doc(profileId).get()
  return doc.exists ? (doc.data() as ConnectAccountRecord) : null
}

export async function getOrCreateConnectedAccount(params: {
  profileId: string
  email?: string | null
}) {
  const stripe = getStripe()
  const existing = await getExistingConnectedAccount(params.profileId)

  if (existing?.stripe_account_id) {
    try {
      const account = await stripe.accounts.retrieve(existing.stripe_account_id)
      const row = await syncConnectedAccount(params.profileId, account)
      return { stripe, account, row }
    } catch (err: any) {
      // Only replace the stored account when Stripe says it's genuinely
      // invalid/missing for the current key+mode (e.g. a test account after the
      // switch to the live key). On ANY transient error (network, rate-limit,
      // 5xx) we RE-THROW — never silently orphan a linked bank account and create
      // a duplicate. This keeps a connected bank permanent across blips.
      const invalid =
        err?.type === 'StripeInvalidRequestError' ||
        err?.type === 'StripePermissionError' ||
        err?.code === 'resource_missing' ||
        err?.code === 'account_invalid' ||
        err?.statusCode === 403 ||
        err?.statusCode === 404
      if (!invalid) {
        throw err
      }
      console.warn('getOrCreateConnectedAccount: stored account invalid for this key/mode, creating new:', err?.message)
    }
  }

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: params.email || undefined,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      citybeat_profile_id: params.profileId,
    },
  })

  const row = await syncConnectedAccount(params.profileId, account)
  return { stripe, account, row }
}
