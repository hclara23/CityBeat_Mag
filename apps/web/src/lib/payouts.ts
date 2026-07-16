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
  // The Editor stakeholder who earns a cut of every sale per the split table below.
  editor_user_id: string
  updated_at?: string
  updated_by?: string
}

// The Editor (citybeatmag@yahoo.com) — earns a share of every sale. Overridable
// via payout_settings.editor_user_id.
const DEFAULT_EDITOR_UID = '01a0ce57-68dd-4356-a459-274d7ee4e6db'

const SETTINGS_DOC = () => adminDb.collection('payout_settings').doc('global')

const DEFAULTS: PayoutSettings = {
  default_payout_percent: 0,
  service_payout_percent: { directory: 0, ad_campaign: 0, sponsored_post: 0 },
  user_overrides: {},
  commission_mode: 'one_time',
  editor_user_id: DEFAULT_EDITOR_UID,
}

// ── Multi-party commission split ────────────────────────────────────────────
// Only the EDITOR and the SALES REP receive real Stripe transfers. "App" and
// "Developer" are the platform's own cut and simply stay in the platform balance
// (so every rule totals 100% with the platform keeping the remainder).
//
// Channel is derived from who sold it: editor (seller == editor), rep (seller is
// someone else), or autonomous (no attributed seller — the AI agent or an organic
// self-serve buyer).
export type SplitBucket = 'directory' | 'ads'
export type SplitChannel = 'editor' | 'rep' | 'autonomous'

// { editor%, rep% } transferred out; platform (App + Developer) keeps the rest.
export const SPLIT_RATES: Record<SplitBucket, Record<SplitChannel, { editor: number; rep: number }>> = {
  directory: {
    editor: { editor: 45, rep: 0 }, // editor sold: editor 45 · platform 55
    rep: { editor: 25, rep: 40 }, //    rep sold: rep 40 · editor 25 · platform 35
    autonomous: { editor: 40, rep: 0 }, // AI/organic: editor 40 · platform 60
  },
  ads: {
    editor: { editor: 65, rep: 0 }, // editor sold: editor 65 · platform 35
    rep: { editor: 20, rep: 50 }, //    rep sold: rep 50 · editor 20 · platform 30
    autonomous: { editor: 0, rep: 0 }, // no rule given → platform keeps 100
  },
}

// Directory is its own bucket; everything else (ad_campaign, sponsored_post, plus
// jobs / event features / custom field sales) follows the ads split.
export function bucketForService(service: string): SplitBucket {
  return service === 'directory' ? 'directory' : 'ads'
}

export type SplitShare = { payeeUserId: string; role: 'editor' | 'rep'; percent: number }

export function computeSplit(service: string, sellerUserId: string | null, editorUserId: string): SplitShare[] {
  const bucket = bucketForService(service)
  const channel: SplitChannel = !sellerUserId ? 'autonomous' : sellerUserId === editorUserId ? 'editor' : 'rep'
  const rates = SPLIT_RATES[bucket][channel]
  const shares: SplitShare[] = []
  if (rates.editor > 0 && editorUserId) shares.push({ payeeUserId: editorUserId, role: 'editor', percent: rates.editor })
  if (rates.rep > 0 && sellerUserId && sellerUserId !== editorUserId) shares.push({ payeeUserId: sellerUserId, role: 'rep', percent: rates.rep })
  return shares
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
    editor_user_id: data.editor_user_id || DEFAULT_EDITOR_UID,
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
  // Split engine passes an explicit percent + role; otherwise it's resolved from
  // the single-payee settings (default / per-service / per-user override).
  percent?: number
  role?: 'editor' | 'rep' | string | null
}): Promise<{ status: string; amount?: number; transferId?: string }> {
  const { stripe, payeeUserId, service, amountTotal, currency = 'usd', sourcePaymentId, role = null } = params
  if (!payeeUserId || !amountTotal || amountTotal <= 0) return { status: 'skipped:no_payee_or_amount' }

  let percent = params.percent
  if (typeof percent !== 'number') {
    const settings = await getPayoutSettings()
    percent = resolvePayoutPercent(settings, service, payeeUserId)
  }
  if (percent <= 0) return { status: 'skipped:zero_percent' }

  const acctDoc = await adminDb.collection('stripe_connected_accounts').doc(payeeUserId).get()
  const acct = acctDoc.exists ? (acctDoc.data() as any) : null
  if (!acct?.stripe_account_id || !acct.payouts_enabled) {
    await adminDb.collection('transfers').add({
      payee_user_id: payeeUserId,
      service,
      role,
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
    role,
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

// Multi-party split for a completed payment. Issues a transfer to the Editor and
// (when a different rep sold it) to the Sales rep, per SPLIT_RATES. The platform
// keeps the remainder (App + Developer). Reuses payoutToUser's idempotency +
// ledger, so a webhook retry never double-pays. No-ops safely with 0 shares.
export async function payoutSplit(params: {
  stripe: Stripe
  sellerUserId?: string | null
  service: string
  amountTotal?: number | null
  currency?: string
  sourcePaymentId?: string | null
}): Promise<{ shares: number; results: Array<{ role: string; payeeUserId: string; status: string; amount?: number }> }> {
  const { stripe, sellerUserId, service, amountTotal, currency = 'usd', sourcePaymentId } = params
  if (!amountTotal || amountTotal <= 0) return { shares: 0, results: [] }

  const settings = await getPayoutSettings()
  const editorUid = settings.editor_user_id || DEFAULT_EDITOR_UID
  const split = computeSplit(service, sellerUserId || null, editorUid)

  const results: Array<{ role: string; payeeUserId: string; status: string; amount?: number }> = []
  for (const share of split) {
    const r = await payoutToUser({
      stripe,
      payeeUserId: share.payeeUserId,
      service,
      amountTotal,
      currency,
      sourcePaymentId,
      percent: share.percent,
      role: share.role,
    })
    results.push({ role: share.role, payeeUserId: share.payeeUserId, status: r.status, amount: r.amount })
  }
  return { shares: split.length, results }
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
