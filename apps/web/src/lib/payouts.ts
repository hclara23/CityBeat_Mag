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
import {
  clawbackTransition,
  commissionEligibleAt,
  isCommissionDue,
} from './commission-schedule'
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
    // A clawback can land between this run reading its snapshot and the transfer
    // completing. Blindly writing status:'paid' would silently overwrite that
    // reversal, leaving a refunded sale marked paid with no alert. Money HAS
    // left the platform at this point, so the reversal is not undone — the row
    // records the transfer and stays in its clawback state for a human.
    const clobbered = await adminDb
      .runTransaction(async (transaction) => {
        const fresh = await transaction.get(ledgerRef)
        const status = fresh.exists ? (fresh.data() as any)?.status : null
        const reversedMidFlight = status === 'reversed' || status === 'clawback_owed'
        transaction.set(
          ledgerRef,
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
            // Keep the clawback status; never demote it back to 'paid'.
            ...(reversedMidFlight
              ? { paid_after_clawback: true, paid_after_clawback_at: new Date().toISOString() }
              : { status: 'paid', error_code: null, error_message: null }),
            paid_at: FieldValue.serverTimestamp(),
            attempts: FieldValue.increment(1),
          },
          { merge: true }
        )
        return reversedMidFlight
      })
      .catch(() => false)

    if (clobbered) {
      await reportFailure(
        'payout-clawback-race',
        new Error(
          `A commission transfer completed for a share that was clawed back mid-run — $${(actualAmount / 100).toFixed(2)} left the platform for a reversed sale`
        ),
        { service, payee_user_id: payeeUserId, source_payment: sourcePaymentId, transfer_id: transferId }
      ).catch(() => {})
    }
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

// DEPRECATED — DO NOT USE FOR COMMISSION.
//
// Pays a share IMMEDIATELY, bypassing the 7-day refund hold and the 1st/15th
// payout cycle. Commission must go through payoutSplit (accrue as `held`) and
// runPayoutCycle instead; paying instantly is exactly the behaviour the accrual
// model replaced, because a next-day refund then means chasing money that has
// already left the platform.
//
// Kept only because it is the shared implementation path that executeTransfer
// and the reconcile pass are built around, and removing it now would be a
// larger refactor of money-critical code than this change warrants. It has no
// callers. Godmode's deliberate one-off payout uses manualPayout() instead,
// which is intentionally immediate.
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

// Multi-party split for a completed payment. ACCRUES the Editor's and (when a
// different rep sold it) the Sales rep's share per SPLIT_RATES; the platform
// keeps the remainder (App + Developer). No money moves here.
//
// Shares are written to the `transfers` ledger as `held` with an `eligible_at`
// COMMISSION_HOLD_DAYS after the sale. runPayoutCycle() pays them out on the
// 1st and the 15th, once that refund window has closed. This exists so a
// customer who refunds or changes their mind inside the window costs the
// business nothing: the commission is simply reversed before it was ever sent
// (see clawbackCommission). Before this, every share transferred instantly at
// webhook time and a next-day refund meant chasing money already paid out.
//
// Still idempotent: the deterministic ledger id means a duplicate webhook
// delivery re-writes the same row instead of accruing a second share, and an
// already-`paid` share is never reopened.
export async function payoutSplit(params: {
  stripe: Stripe
  sellerUserId?: string | null
  service: string
  amountTotal?: number | null
  currency?: string
  sourcePaymentId?: string | null
  // The charge id behind this payment — stored now and used at payout time so the
  // transfer can draw against that charge (see payoutToUser).
  sourceTransaction?: string | null
  // Sale timestamp; the hold window is measured from here. Defaults to now.
  saleAt?: Date | string | null
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

  const saleAt = params.saleAt ? new Date(params.saleAt) : new Date()
  const saleAtIso = Number.isFinite(saleAt.getTime()) ? saleAt.toISOString() : new Date().toISOString()
  const eligibleAt = commissionEligibleAt(saleAtIso)

  const allocated = allocateShareCents(split, amountTotal, transferableBase)
  const results: Array<{ role: string; payeeUserId: string; status: string; amount?: number }> = []
  for (const share of allocated) {
    const docId = ledgerDocId(service, share.payeeUserId, sourcePaymentId)
    const ledgerRef = docId
      ? adminDb.collection('transfers').doc(docId)
      : adminDb.collection('transfers').doc()

    // Never reopen a share that already settled or was reversed — a duplicate
    // webhook delivery must not resurrect a clawed-back commission.
    const existing = await ledgerRef.get().catch(() => null)
    const existingData = existing?.exists ? (existing.data() as any) : null
    const existingStatus = existingData?.status ?? null
    if (existingStatus && existingStatus !== 'held') {
      results.push({ role: share.role, payeeUserId: share.payeeUserId, status: `skipped:${existingStatus}` })
      continue
    }

    // Stripe delivers at-least-once, and a redelivery can arrive days later. The
    // hold must run from the ORIGINAL sale, so an existing row keeps its own
    // sale_at/eligible_at — recomputing them here would silently push the rep's
    // payout back by another full hold window on every retry.
    const firstSaleAt = typeof existingData?.sale_at === 'string' ? existingData.sale_at : saleAtIso
    const firstEligibleAt =
      typeof existingData?.eligible_at === 'string' ? existingData.eligible_at : eligibleAt

    await ledgerRef.set(
      {
        payee_user_id: share.payeeUserId,
        service,
        role: share.role,
        percent: share.percent,
        amount: share.amountCents,
        currency,
        source_payment: sourcePaymentId,
        source_transaction: sourceTransaction,
        status: 'held',
        sale_at: firstSaleAt,
        eligible_at: firstEligibleAt,
        accrued_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    results.push({
      role: share.role,
      payeeUserId: share.payeeUserId,
      status: 'held',
      amount: share.amountCents,
    })
  }
  return { shares: allocated.length, results }
}

// Pays every commission whose refund window has closed. Scheduled on the 1st and
// the 15th (citybeat-payout-cycle). Only touches `held` rows that are past
// `eligible_at`, so it can never race reconcileFailedTransfers (which only
// touches `failed` / `skipped_no_connected_account`). Each payment still goes
// through executeTransfer, keeping the ledger + idempotency + transfer_group
// guarantees that make double-paying impossible.
export async function runPayoutCycle(params: {
  stripe: Stripe
  limit?: number
  dryRun?: boolean
  now?: Date | string
}): Promise<{
  scanned: number
  due: number
  paid: number
  failed: number
  no_bank: number
  amount_paid: number
}> {
  const { stripe, limit = 200, dryRun = false } = params
  const now = params.now ? new Date(params.now) : new Date()

  const snap = await adminDb
    .collection('transfers')
    .where('status', '==', 'held')
    .limit(limit)
    .get()
    .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))

  const summary = { scanned: snap.docs.length, due: 0, paid: 0, failed: 0, no_bank: 0, amount_paid: 0 }

  for (const doc of snap.docs) {
    const row = doc.data() as any
    if (!isCommissionDue(row, now)) continue
    summary.due++

    const payeeUserId: string | undefined = row.payee_user_id
    const service: string = row.service
    const amount = Math.max(0, Math.round(Number(row.amount) || 0))
    if (!payeeUserId || !service || amount <= 0) continue
    if (dryRun) continue

    // Re-read immediately before moving money: this loop walks a point-in-time
    // snapshot, and a refund/cancellation clawback may have reversed the share
    // since it was taken.
    const fresh = await doc.ref.get().catch(() => null)
    if (!fresh?.exists || (fresh.data() as any)?.status !== 'held') continue

    const acctDoc = await adminDb.collection('stripe_connected_accounts').doc(payeeUserId).get().catch(() => null)
    const acct = acctDoc?.exists ? (acctDoc.data() as any) : null
    if (!acct?.stripe_account_id || !acct.payouts_enabled) {
      // Keep the full context so reconcileFailedTransfers completes this the day
      // the rep finishes connecting a bank.
      await doc.ref.set({ status: 'skipped_no_connected_account' }, { merge: true })
      summary.no_bank++
      continue
    }

    const result = await executeTransfer({
      stripe,
      payeeUserId,
      destination: acct.stripe_account_id,
      service,
      role: row.role || null,
      percent: Number(row.percent) || 0,
      amount,
      currency: row.currency || 'usd',
      sourcePaymentId: row.source_payment || null,
      sourceTransaction: row.source_transaction || null,
      ledgerRef: doc.ref,
    })
    if (result.status === 'paid') {
      summary.paid++
      summary.amount_paid += result.amount || amount
    } else if (result.status === 'failed') {
      summary.failed++
    }
  }

  return summary
}

// Reverses commission when a customer refunds, cancels, or disputes.
// Inside the hold window the share is still `held`, so this costs nothing —
// it flips to `reversed` and no money ever leaves. If the cycle already paid
// it, the share becomes `clawback_owed`: a debt recorded against the rep that
// nets off their next payout. Idempotent — re-running on an already-reversed
// share is a no-op (see clawbackTransition).
export async function clawbackCommission(params: {
  // The checkout session id the commission was accrued against.
  sourcePaymentId?: string | null
  // The charge id. Every accrued share stores this as `source_transaction`, which
  // is the only handle that works for SELF-SERVE sales — those have no
  // sales_orders row to recover a session id from, so matching on the charge is
  // what makes a self-serve refund actually reverse its commission.
  sourceTransaction?: string | null
  reason: 'refund' | 'dispute' | 'canceled'
  // When true, only reverse shares still inside the hold window and leave
  // already-paid ones alone. Used for a plain subscription cancellation: the
  // customer received the months they paid for, so the rep keeps that
  // commission. A refund or dispute — where money actually went back to the
  // customer — passes false and reverses paid shares into a debt.
  heldOnly?: boolean
}): Promise<{ reversed: number; owed: number; amount_owed: number; kept_paid: number }> {
  const { sourcePaymentId, sourceTransaction, reason, heldOnly = false } = params
  const summary = { reversed: 0, owed: 0, amount_owed: 0, kept_paid: 0 }
  if (!sourcePaymentId && !sourceTransaction) return summary

  const queries: Promise<FirebaseFirestore.QuerySnapshot | { docs: FirebaseFirestore.QueryDocumentSnapshot[] }>[] = []
  if (sourcePaymentId) {
    queries.push(
      adminDb
        .collection('transfers')
        .where('source_payment', '==', sourcePaymentId)
        .get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    )
  }
  if (sourceTransaction) {
    queries.push(
      adminDb
        .collection('transfers')
        .where('source_transaction', '==', sourceTransaction)
        .get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    )
  }
  const snaps = await Promise.all(queries)
  // The two lookups can return the same row; dedupe by document path.
  const byPath = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  for (const snap of snaps) {
    for (const doc of snap.docs) byPath.set(doc.ref.path, doc)
  }

  const now = new Date().toISOString()
  for (const doc of byPath.values()) {
    const row = doc.data() as any
    const transition = clawbackTransition(row.status)
    if (!transition) continue

    // A plain cancellation reverses ONLY shares genuinely still inside the
    // 7-day refund window. Gating on `alreadyPaid` instead was wrong: it also
    // reversed every share that was earned but not yet transferred — a matured
    // `held` row waiting for the next 1st/15th cycle, a `failed` row awaiting
    // the daily reconcile, and (with no time limit at all) a
    // `skipped_no_connected_account` row belonging to a rep who simply hadn't
    // finished connecting a bank. Nothing reads `reversed`, so those were
    // destroyed permanently and silently, for service the customer had already
    // received and never got refunded.
    if (heldOnly && (row.status !== 'held' || isCommissionDue(row, now))) {
      summary.kept_paid++
      continue
    }

    await doc.ref.set(
      {
        status: transition.next,
        clawback_reason: reason,
        clawback_at: now,
      },
      { merge: true }
    )

    if (transition.alreadyPaid) {
      summary.owed++
      summary.amount_owed += Math.max(0, Math.round(Number(row.amount) || 0))
    } else {
      summary.reversed++
    }
  }

  // A commission already paid out cannot be pulled back from the rep's bank
  // automatically — that is a real debt an operator has to net off or collect,
  // so make sure a human is told rather than leaving it buried in the ledger.
  if (summary.owed > 0) {
    await reportFailure(
      'commission-clawback',
      new Error(
        `${summary.owed} already-paid commission share(s) totalling $${(summary.amount_owed / 100).toFixed(2)} must be clawed back after a ${reason}`
      ),
      { source_payment: sourcePaymentId, source_transaction: sourceTransaction, reason }
    ).catch(() => {})
  }

  return summary
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

    // Never pay before the refund window closes. `failed` / `skipped` rows
    // normally reach this state only after the payout cycle already released
    // them, so this is a belt-and-braces guard; rows predating the accrual model
    // carry no eligible_at and stay immediately retryable, which is correct —
    // they were earned under the old pay-immediately policy.
    if (typeof t.eligible_at === 'string' && t.eligible_at) {
      const eligible = new Date(t.eligible_at)
      if (Number.isFinite(eligible.getTime()) && eligible.getTime() > Date.now()) {
        skipped++
        continue
      }
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
  // Caller-supplied de-duplication handle. Two requests sharing one become ONE
  // transfer at Stripe. Without it a double-click, an impatient retry, or a
  // flaky connection sends real money twice — this endpoint had no idempotency
  // key and appended an auto-id ledger row, so nothing anywhere caught it.
  requestId?: string
}): Promise<{ status: 'paid'; amount: number; transferId: string }> {
  const { stripe, payeeUserId, amount, currency = 'usd', issuedBy, note } = params
  if (!payeeUserId) throw new Error('Missing payee')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than 0')

  const acctDoc = await adminDb.collection('stripe_connected_accounts').doc(payeeUserId).get()
  const acct = acctDoc.exists ? (acctDoc.data() as any) : null
  if (!acct?.stripe_account_id || !acct.payouts_enabled) {
    throw new Error('Payee has not finished connecting a payouts-enabled bank account')
  }

  // Falls back to a per-minute bucket so a double-click collapses into one
  // transfer even when the caller supplies no requestId.
  const dedupeHandle =
    params.requestId && params.requestId.trim()
      ? params.requestId.trim().slice(0, 80)
      : `auto:${Math.floor(Date.now() / 60000)}`
  const idempotencyKey = `manual:${issuedBy}:${payeeUserId}:${Math.round(amount)}:${currency}:${dedupeHandle}`

  const transfer = await stripe.transfers.create(
    {
      amount: Math.round(amount),
      currency,
      destination: acct.stripe_account_id,
      metadata: { service: 'manual', payee_user_id: payeeUserId, issued_by: issuedBy },
    },
    { idempotencyKey }
  )

  await adminDb.collection('transfers').doc(idempotencyKey.replace(/\//g, '_')).set({
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
