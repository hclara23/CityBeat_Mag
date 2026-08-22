import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import {
  allocateShareCents,
  buildTransferRequest,
  computeSplit,
  ledgerDocId,
  normalizeSplitOverrides,
  type SplitOverrides,
} from './payout-split'
import { reportFailure, reportSuccess } from './alerts'

export {
  SPLIT_RATES,
  allocateShareCents,
  bucketForService,
  buildTransferRequest,
  computeSplit,
  ledgerDocId,
  normalizeSplitOverrides,
  transferIdempotencyKey,
  type SplitBucket,
  type SplitChannel,
  type SplitShare,
  type SplitOverride,
  type SplitOverrides,
} from './payout-split'

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
  // Per-individual commission overrides for the multi-party split. Keyed by UID;
  // each entry sets what that person earns (0–100) on a directory / ads sale
  // where they are the editor or the selling rep. Overrides the SPLIT_RATES table.
  split_overrides: SplitOverrides
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
  split_overrides: {},
  commission_mode: 'one_time',
  editor_user_id: DEFAULT_EDITOR_UID,
}

export async function getPayoutSettings(): Promise<PayoutSettings> {
  const doc = await SETTINGS_DOC().get()
  if (!doc.exists) return { ...DEFAULTS }
  const data = doc.data() as any
  return {
    default_payout_percent: data.default_payout_percent ?? 0,
    service_payout_percent: { ...DEFAULTS.service_payout_percent, ...(data.service_payout_percent || {}) },
    user_overrides: data.user_overrides || {},
    split_overrides: normalizeSplitOverrides(data.split_overrides),
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

// Creates the Stripe transfer and records it in the `transfers` ledger.
// NON-THROWING: on a Stripe error it records a `failed` row (with everything the
// reconcile pass needs to retry) and alerts ops — it never rethrows. That way a
// rep's payout can never block the customer's fulfillment or wedge the Stripe
// webhook into a 500 retry-storm. `existingRef`, when given, is updated in place
// (a reconcile retry) instead of appending a new row.
async function executeTransfer(input: {
  stripe: Stripe
  payeeUserId: string
  destination: string
  service: string
  role?: string | null
  percent: number
  amount: number
  currency: string
  sourcePaymentId?: string | null
  sourceTransaction?: string | null
  // The single ledger document for this share (deterministic id) — every state
  // (skipped → failed → paid) is written here with set/merge, so duplicate
  // deliveries and retries never append duplicate rows.
  ledgerRef: FirebaseFirestore.DocumentReference
}): Promise<{ status: 'paid' | 'failed' | 'in_progress'; amount?: number; transferId?: string; error?: string }> {
  const {
    stripe, payeeUserId, destination, service, role = null, percent, amount, currency,
    sourcePaymentId = null, sourceTransaction = null, ledgerRef,
  } = input

  // The stable key is the idempotency key on EVERY attempt, so Stripe collapses any
  // concurrent create of this share into one transfer. transferGroup finds an
  // already-created transfer when the key has expired.
  const { params, idempotencyKey, transferGroup } = buildTransferRequest({
    amount, currency, destination, service, payeeUserId, sourcePaymentId, sourceTransaction,
  })

  const recordPaid = async (transferId: string, actualAmount: number) => {
    await ledgerRef.set(
      {
        payee_user_id: payeeUserId,
        service,
        role,
        percent,
        amount: actualAmount,
        currency,
        source_payment: sourcePaymentId,
        source_transaction: sourceTransaction,
        stripe_transfer_id: transferId,
        stripe_destination: destination,
        status: 'paid',
        error_code: null,
        error_message: null,
        paid_at: FieldValue.serverTimestamp(),
        attempts: FieldValue.increment(1),
      },
      { merge: true }
    )
  }

  // Anti-double-pay backstop: if a transfer for this exact share already exists on
  // Stripe — a prior attempt committed but its ledger row was lost, or the
  // idempotency key has since expired (>24h) — adopt it instead of creating a
  // second transfer. The lookup result is captured here and acted on OUTSIDE the
  // try so a transient recordPaid error can never fall through to a second create.
  let adopted: { id: string; amount: number } | null = null
  if (transferGroup) {
    try {
      const prior = await stripe.transfers.list({ transfer_group: transferGroup, limit: 1 })
      const t = prior.data[0]
      if (t) adopted = { id: t.id, amount: t.amount }
    } catch {
      /* lookup is best-effort; the shared idempotency key still guards the race */
    }
  }
  if (adopted) {
    await recordPaid(adopted.id, adopted.amount)
    return { status: 'paid', amount: adopted.amount, transferId: adopted.id }
  }

  let transfer: Stripe.Transfer
  try {
    transfer = await stripe.transfers.create(
      params as unknown as Stripe.TransferCreateParams,
      idempotencyKey ? { idempotencyKey } : undefined
    )
  } catch (err: any) {
    // Concurrency, not failure: Stripe returns HTTP 409 (idempotency_error) when
    // another in-flight request already holds this key — i.e. a duplicate delivery
    // or a reconcile run is creating this exact transfer right now. Don't overwrite
    // the winner's row to 'failed' or fire a spurious alert; let that request (or
    // the next reconcile's transfer_group adoption) record the outcome.
    const errType = err?.type || err?.raw?.type
    const errCode = err?.code || err?.raw?.code
    const status = err?.statusCode ?? err?.raw?.statusCode
    if (errType === 'idempotency_error' || errCode === 'idempotency_key_in_use' || status === 409) {
      return { status: 'in_progress', error: 'idempotency_in_progress' }
    }
    await ledgerRef.set(
      {
        payee_user_id: payeeUserId,
        service,
        role,
        percent,
        amount,
        currency,
        source_payment: sourcePaymentId,
        source_transaction: sourceTransaction,
        stripe_destination: destination,
        status: 'failed',
        error_code: errCode || null,
        error_message: String(err?.message || err).slice(0, 300),
        attempts: FieldValue.increment(1),
        last_attempt_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    // Best-effort ops alert (deduped 3/6h); a failed commission is worth knowing
    // about but must not fail the caller.
    await reportFailure('payout-transfer', err, {
      service, payee_user_id: payeeUserId, source_payment: sourcePaymentId,
    }).catch(() => {})
    return { status: 'failed', error: (errCode || 'transfer_error') as string }
  }

  await recordPaid(transfer.id, amount)
  return { status: 'paid', amount, transferId: transfer.id }
}

// Pays the configured share of a completed payment to a user's connected account
// via a Stripe transfer, and records it in the `transfers` collection.
// No-ops safely when: no payee, percent is 0, or the payee has no payouts-enabled
// connected account. A transfer that Stripe rejects is recorded `failed` (for the
// reconcile pass) rather than thrown — see executeTransfer.
export async function payoutToUser(params: {
  stripe: Stripe
  payeeUserId?: string | null
  service: string
  amountTotal?: number | null
  currency?: string
  sourcePaymentId?: string | null
  // The charge id behind this payment. Passing it lets Stripe accept the transfer
  // against a still-`pending` charge (no available-balance requirement), which is
  // what prevents the "insufficient funds" failure on fresh sales.
  sourceTransaction?: string | null
  // Explicit cents for this share (from payoutSplit's cent-exact allocation). When
  // omitted, the amount is this share's own rounding of amountTotal * percent.
  amountCents?: number
  // Split engine passes an explicit percent + role; otherwise it's resolved from
  // the single-payee settings (default / per-service / per-user override).
  percent?: number
  role?: 'editor' | 'rep' | string | null
}): Promise<{ status: string; amount?: number; transferId?: string }> {
  const {
    stripe, payeeUserId, service, amountTotal, currency = 'usd',
    sourcePaymentId = null, sourceTransaction = null, role = null,
  } = params
  if (!payeeUserId || !amountTotal || amountTotal <= 0) return { status: 'skipped:no_payee_or_amount' }

  let percent = params.percent
  if (typeof percent !== 'number') {
    const settings = await getPayoutSettings()
    percent = resolvePayoutPercent(settings, service, payeeUserId)
  }
  if (percent <= 0) return { status: 'skipped:zero_percent' }

  // Amount in cents: an explicit allocation (from payoutSplit) wins so multi-share
  // rounding stays cent-exact and can't over-transfer; otherwise this share rounds
  // its own slice.
  const amount = typeof params.amountCents === 'number'
    ? Math.max(0, Math.round(params.amountCents))
    : Math.round((amountTotal * percent) / 100)
  if (amount <= 0) return { status: 'skipped:zero_amount' }

  // One deterministic ledger document per share, so skip/fail/retry/duplicate all
  // land on the same row (no duplicate 'paid' rows to double-count in finance).
  const docId = ledgerDocId(service, payeeUserId, sourcePaymentId)
  const ledgerRef = docId
    ? adminDb.collection('transfers').doc(docId)
    : adminDb.collection('transfers').doc()

  // The account read is wrapped so a transient error records a reconcilable skip
  // rather than aborting a multi-share split mid-loop.
  const acctDoc = await adminDb
    .collection('stripe_connected_accounts')
    .doc(payeeUserId)
    .get()
    .catch(() => null)
  const acct = acctDoc?.exists ? (acctDoc.data() as any) : null
  if (!acct?.stripe_account_id || !acct.payouts_enabled) {
    // Record the FULL context (intended amount + charge) so the reconcile pass can
    // complete this share once the payee finishes connecting a bank.
    await ledgerRef.set(
      {
        payee_user_id: payeeUserId,
        service,
        role,
        percent,
        amount,
        currency,
        source_payment: sourcePaymentId,
        source_transaction: sourceTransaction,
        status: 'skipped_no_connected_account',
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return { status: 'skipped:no_connected_account' }
  }

  // Idempotency: Stripe delivers webhooks at-least-once. Guard three ways so a
  // retried event never double-pays: (a) this ledger check for an already-`paid`
  // share, (b) the stable Stripe idempotency key, and (c) the transfer_group
  // backstop — all inside/around executeTransfer.
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

  return executeTransfer({
    stripe,
    payeeUserId,
    destination: acct.stripe_account_id,
    service,
    role,
    percent,
    amount,
    currency,
    sourcePaymentId,
    sourceTransaction,
    ledgerRef,
  })
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
  // The charge id behind this payment (see payoutToUser) — threaded to every share
  // so each transfer draws from the charge even while its funds are still pending.
  sourceTransaction?: string | null
}): Promise<{ shares: number; results: Array<{ role: string; payeeUserId: string; status: string; amount?: number }> }> {
  const {
    stripe, sellerUserId, service, amountTotal, currency = 'usd',
    sourcePaymentId = null, sourceTransaction = null,
  } = params
  if (!amountTotal || amountTotal <= 0) return { shares: 0, results: [] }

  const settings = await getPayoutSettings()
  const editorUid = settings.editor_user_id || DEFAULT_EDITOR_UID
  const split = computeSplit(service, sellerUserId || null, editorUid, settings.split_overrides)
  if (!split.length) return { shares: 0, results: [] }

  // A transfer tied to a charge (source_transaction) can draw at most that charge's
  // net-of-fees contribution to the balance. Cap the cumulative payout at that net
  // so a near-100% split never fails its last transfer; fall back to gross when the
  // charge/fee can't be read (allocateShareCents still bounds the total to gross).
  let transferableBase = amountTotal
  if (sourceTransaction) {
    try {
      const charge = await stripe.charges.retrieve(sourceTransaction, { expand: ['balance_transaction'] })
      const bt: any = (charge as any).balance_transaction
      if (bt && typeof bt === 'object' && typeof bt.net === 'number' && bt.net > 0) {
        transferableBase = Math.min(amountTotal, bt.net)
      }
    } catch {
      /* keep gross base */
    }
  }

  const allocated = allocateShareCents(split, amountTotal, transferableBase)
  const results: Array<{ role: string; payeeUserId: string; status: string; amount?: number }> = []
  for (const share of allocated) {
    const r = await payoutToUser({
      stripe,
      payeeUserId: share.payeeUserId,
      service,
      amountTotal,
      currency,
      sourcePaymentId,
      sourceTransaction,
      amountCents: share.amountCents,
      percent: share.percent,
      role: share.role,
    })
    results.push({ role: share.role, payeeUserId: share.payeeUserId, status: r.status, amount: r.amount })
  }
  return { shares: allocated.length, results }
}

// Completes payouts that didn't go through at webhook time — either `failed`
// (e.g. a fresh charge's funds hadn't settled, or Stripe was rate-limited) or
// `skipped_no_connected_account` (the payee hadn't connected a bank yet; they may
// have since). Safe to run repeatedly and concurrently with the webhook: a share
// already `paid` is skipped (ledger check + transfer_group backstop), the shared
// idempotency key means Stripe collapses any race to one transfer, and the backstop
// adopts an already-created one — so it can never double-pay. Returns a run summary.
export async function reconcileFailedTransfers(params: {
  stripe: Stripe
  limit?: number
  dryRun?: boolean
}): Promise<{ scanned: number; paid: number; still_failing: number; superseded: number; skipped: number }> {
  const { stripe, limit = 50, dryRun = false } = params
  // Query the two statuses SEPARATELY (each single-equality, no composite index) so
  // a backlog of never-connecting `skipped` rows can never starve the scan window
  // and hide a recoverable `failed` row — each status gets its own `limit` budget.
  const [failedSnap, skippedSnap] = await Promise.all([
    adminDb
      .collection('transfers')
      .where('status', '==', 'failed')
      .limit(limit)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    adminDb
      .collection('transfers')
      .where('status', '==', 'skipped_no_connected_account')
      .limit(limit)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
  ])
  const snap = { docs: [...failedSnap.docs, ...skippedSnap.docs] }

  let paid = 0
  let stillFailing = 0
  let superseded = 0
  let skipped = 0

  for (const doc of snap.docs) {
    const t = doc.data() as any
    const payeeUserId: string | undefined = t.payee_user_id
    const service: string = t.service
    const amount = Number(t.amount || 0)
    const sourcePaymentId: string | null = t.source_payment || null

    // Not enough on the row to retry safely (e.g. a legacy pre-fix
    // skipped_no_connected_account row with amount:0). Retire it so it can't keep
    // occupying the limited scan window and starve real failed/skipped rows.
    if (!payeeUserId || !service || amount <= 0) {
      if (!dryRun) {
        await doc.ref.set({ status: 'skipped_invalid' }, { merge: true }).catch(() => {})
      }
      skipped++
      continue
    }

    // Already settled by another path (webhook retry, prior reconcile)? Never re-pay.
    if (sourcePaymentId) {
      const already = await adminDb
        .collection('transfers')
        .where('source_payment', '==', sourcePaymentId)
        .where('service', '==', service)
        .where('payee_user_id', '==', payeeUserId)
        .where('status', '==', 'paid')
        .limit(1)
        .get()
        .catch(() => ({ empty: true } as any))
      if (!already.empty) {
        if (!dryRun) {
          await doc.ref.set(
            { status: 'superseded', superseded_at: FieldValue.serverTimestamp() },
            { merge: true }
          )
        }
        superseded++
        continue
      }
    }

    // The payee must have a payouts-enabled connected account now.
    const acctDoc = await adminDb.collection('stripe_connected_accounts').doc(payeeUserId).get()
    const acct = acctDoc.exists ? (acctDoc.data() as any) : null
    if (!acct?.stripe_account_id || !acct.payouts_enabled) {
      stillFailing++
      continue
    }

    if (dryRun) {
      stillFailing++
      continue
    }

    const res = await executeTransfer({
      stripe,
      payeeUserId,
      destination: acct.stripe_account_id,
      service,
      role: t.role || null,
      percent: Number(t.percent || 0),
      amount,
      currency: t.currency || 'usd',
      sourcePaymentId,
      sourceTransaction: t.source_transaction || null,
      ledgerRef: doc.ref,
    })
    if (res.status === 'paid') paid++
    else if (res.status === 'in_progress') skipped++ // another request is creating it
    else stillFailing++
  }

  // Clear the ops alert once nothing is left failing in this batch.
  if (!dryRun && paid > 0 && stillFailing === 0) {
    await reportSuccess('payout-transfer').catch(() => {})
  }

  return { scanned: snap.docs.length, paid, still_failing: stillFailing, superseded, skipped }
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
