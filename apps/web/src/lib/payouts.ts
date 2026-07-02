import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// Services that can pay out a share to a user (per the godmode config).
export const PAYOUT_SERVICES = ['directory', 'ad_campaign', 'sponsored_post'] as const
export type PayoutService = (typeof PAYOUT_SERVICES)[number]

// `*_payout_percent` is the percentage of the gross payment the USER receives;
// the platform keeps the remainder. Defaults are 0 → nothing pays out until set.
// commission_mode: 'one_time' pays the rep once (on the first payment); 'residual'
// keeps paying the same percent on every subscription renewal.
export type CommissionMode = 'one_time' | 'residual'

export type PayoutSettings = {
  default_payout_percent: number
  service_payout_percent: Record<string, number>
  user_overrides: Record<string, Record<string, number>>
  commission_mode: CommissionMode
  updated_at?: string
  updated_by?: string
}

const SETTINGS_DOC = () => adminDb.collection('payout_settings').doc('global')

const DEFAULTS: PayoutSettings = {
  default_payout_percent: 0,
  service_payout_percent: { directory: 0, ad_campaign: 0, sponsored_post: 0 },
  user_overrides: {},
  commission_mode: 'one_time',
}

export async function getPayoutSettings(): Promise<PayoutSettings> {
  const doc = await SETTINGS_DOC().get()
  if (!doc.exists) return { ...DEFAULTS }
  const data = doc.data() as any
  return {
    default_payout_percent: data.default_payout_percent ?? 0,
    service_payout_percent: { ...DEFAULTS.service_payout_percent, ...(data.service_payout_percent || {}) },
    user_overrides: data.user_overrides || {},
    commission_mode: data.commission_mode === 'residual' ? 'residual' : 'one_time',
    updated_at: data.updated_at,
    updated_by: data.updated_by,
  }
}

export async function savePayoutSettings(patch: Partial<PayoutSettings>, updatedBy: string): Promise<PayoutSettings> {
  await SETTINGS_DOC().set(
    { ...patch, updated_at: new Date().toISOString(), updated_by: updatedBy },
    { merge: true }
  )
  return getPayoutSettings()
}

export function resolvePayoutPercent(settings: PayoutSettings, service: string, userId?: string): number {
  const override = userId ? settings.user_overrides?.[userId]?.[service] : undefined
  if (typeof override === 'number') return override
  const svc = settings.service_payout_percent?.[service]
  if (typeof svc === 'number') return svc
  return settings.default_payout_percent || 0
}

// Pays the configured share of a completed payment to a user's connected account
// via a Stripe transfer, and records it in the `transfers` collection.
// No-ops safely when: no payee, percent is 0, or the payee has no payouts-enabled
// connected account.
export async function payoutToUser(params: {
  stripe: Stripe
  payeeUserId?: string | null
  service: string
  amountTotal?: number | null
  currency?: string
  sourcePaymentId?: string | null
}): Promise<{ status: string; amount?: number; transferId?: string }> {
  const { stripe, payeeUserId, service, amountTotal, currency = 'usd', sourcePaymentId } = params
  if (!payeeUserId || !amountTotal || amountTotal <= 0) return { status: 'skipped:no_payee_or_amount' }

  const settings = await getPayoutSettings()
  const percent = resolvePayoutPercent(settings, service, payeeUserId)
  if (percent <= 0) return { status: 'skipped:zero_percent' }

  const acctDoc = await adminDb.collection('stripe_connected_accounts').doc(payeeUserId).get()
  const acct = acctDoc.exists ? (acctDoc.data() as any) : null
  if (!acct?.stripe_account_id || !acct.payouts_enabled) {
    await adminDb.collection('transfers').add({
      payee_user_id: payeeUserId,
      service,
      percent,
      amount: 0,
      source_payment: sourcePaymentId || null,
      status: 'skipped_no_connected_account',
      created_at: FieldValue.serverTimestamp(),
    })
    return { status: 'skipped:no_connected_account' }
  }

  const amount = Math.round((amountTotal * percent) / 100)
  if (amount <= 0) return { status: 'skipped:zero_amount' }

  // Idempotency: Stripe delivers webhooks at-least-once. Without this, a retried
  // event would create a SECOND transfer (double-paying the rep). Guard two ways:
  // (a) a Firestore ledger check, and (b) a Stripe idempotency key so even a race
  // can't create a duplicate transfer.
  if (sourcePaymentId) {
    const existing = await adminDb
      .collection('transfers')
      .where('source_payment', '==', sourcePaymentId)
      .where('service', '==', service)
      .where('payee_user_id', '==', payeeUserId)
      .where('status', '==', 'paid')
      .limit(1)
      .get()
      .catch(() => ({ empty: true } as any))
    if (!existing.empty) return { status: 'skipped:already_paid' }
  }

  const transfer = await stripe.transfers.create(
    {
      amount,
      currency,
      destination: acct.stripe_account_id,
      metadata: { service, payee_user_id: payeeUserId, source_payment: sourcePaymentId || '' },
    },
    sourcePaymentId ? { idempotencyKey: `payout:${service}:${payeeUserId}:${sourcePaymentId}` } : undefined
  )

  await adminDb.collection('transfers').add({
    payee_user_id: payeeUserId,
    service,
    percent,
    amount,
    currency,
    source_payment: sourcePaymentId || null,
    stripe_transfer_id: transfer.id,
    stripe_destination: acct.stripe_account_id,
    status: 'paid',
    created_at: FieldValue.serverTimestamp(),
  })

  return { status: 'paid', amount, transferId: transfer.id }
}

// Godmode "issue a payout now": transfers a FLAT amount (cents) to a user's
// connected account, independent of any sale. Throws on bad input / no payable
// account so the caller can surface a clear error. Records to the `transfers`
// ledger so it shows in the user's bank dashboard and the finance dashboard.
export async function manualPayout(params: {
  stripe: Stripe
  payeeUserId: string
  amount: number // cents
  currency?: string
  issuedBy: string
  note?: string
}): Promise<{ status: 'paid'; amount: number; transferId: string }> {
  const { stripe, payeeUserId, amount, currency = 'usd', issuedBy, note } = params
  if (!payeeUserId) throw new Error('Missing payee')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than 0')

  const acctDoc = await adminDb.collection('stripe_connected_accounts').doc(payeeUserId).get()
  const acct = acctDoc.exists ? (acctDoc.data() as any) : null
  if (!acct?.stripe_account_id || !acct.payouts_enabled) {
    throw new Error('Payee has not finished connecting a payouts-enabled bank account')
  }

  const transfer = await stripe.transfers.create({
    amount: Math.round(amount),
    currency,
    destination: acct.stripe_account_id,
    metadata: { service: 'manual', payee_user_id: payeeUserId, issued_by: issuedBy },
  })

  await adminDb.collection('transfers').add({
    payee_user_id: payeeUserId,
    service: 'manual',
    percent: null,
    amount: Math.round(amount),
    currency,
    note: note || null,
    issued_by: issuedBy,
    source_payment: null,
    stripe_transfer_id: transfer.id,
    stripe_destination: acct.stripe_account_id,
    status: 'paid',
    created_at: FieldValue.serverTimestamp(),
  })

  return { status: 'paid', amount: Math.round(amount), transferId: transfer.id }
}
