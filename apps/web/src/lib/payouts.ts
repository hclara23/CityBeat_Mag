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
  partialRefundPlan,
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

// What Stripe told us about a prior transfer for this exact share, before we
// consider creating one.
export type PriorTransferLookup =
  | 'none' // Stripe answered: no transfer exists for this share
  | 'found' // a transfer already exists — adopt it, never create a second
  | 'failed' // the lookup itself errored — we do NOT know either way
  | 'unchecked' // no stable key for this share, so there is no transfer_group to look up

// Whether stripe.transfers.create may be called for this share.
//
// The bug this closes: the transfer_group lookup used to swallow its error into
// `adopted = null`, which is indistinguishable from "Stripe has no transfer for
// this share". A share whose first transfer succeeded but whose ledger write
// failed stays `held` and is re-selected by a later cycle; the stable idempotency
// key expires ~24h after the first attempt, so by then this lookup is the ONLY
// thing between that share and a second real transfer. Refusing to create on an
// inconclusive answer costs at most a delayed payout (the next run retries);
// creating on one pays the rep twice for one sale.
export function mayCreateTransfer(lookup: PriorTransferLookup): boolean {
  return lookup === 'none' || lookup === 'unchecked'
}

// Creates the Stripe transfer and records it in the `transfers` ledger.
// NON-THROWING: on a Stripe error it records a `failed` row (with everything the
// reconcile pass needs to retry) and alerts ops — it never rethrows. That way a
// rep's payout can never block the customer's fulfillment or wedge the Stripe
// webhook into a 500 retry-storm. `existingRef`, when given, is updated in place
// (a reconcile retry) instead of appending a new row.
//
// `paid_unrecorded` is the honest fourth outcome: the transfer went through and
// money left the platform, but the ledger write did not land. Callers must not
// count it as a clean `paid` — the row is still unpaid in Firestore and a human
// has been paged (see recordPaid).
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
}): Promise<{
  status: 'paid' | 'paid_unrecorded' | 'failed' | 'in_progress'
  amount?: number
  transferId?: string
  error?: string
}> {
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

  // Records that the money left, and says whether it managed to.
  //
  // The bug this closes: this transaction used to end in `.catch(() => false)`,
  // and `false` is ALSO the value for "wrote fine, nothing was clawed back". So a
  // transient Firestore error (contention, UNAVAILABLE) landing after a
  // SUCCESSFUL stripe.transfers.create was completely invisible: the row stayed
  // `held` with a past `eligible_at`, /api/admin/finance kept counting the money
  // as an unpaid liability, MyEarnings kept showing the rep unpaid, nothing
  // alerted, and the next cycle re-selected the row to pay it again.
  //
  // The write is a set/merge of fixed values, so replaying it is harmless — only
  // `attempts` moves, and only on a transaction that actually committed.
  const LEDGER_WRITE_ATTEMPTS = 3
  const recordPaid = async (
    transferId: string,
    actualAmount: number
  ): Promise<'recorded' | 'unrecorded'> => {
    let lastError: unknown = null
    for (let attempt = 1; attempt <= LEDGER_WRITE_ATTEMPTS; attempt++) {
      try {
        // A clawback can land between this run reading its snapshot and the transfer
        // completing. Blindly writing status:'paid' would silently overwrite that
        // reversal, leaving a refunded sale marked paid with no alert. Money HAS
        // left the platform at this point, so the reversal is not undone — the row
        // records the transfer and stays in its clawback state for a human.
        const reversedMidFlight = await adminDb.runTransaction(async (transaction) => {
          const fresh = await transaction.get(ledgerRef)
          const status = fresh.exists ? (fresh.data() as any)?.status : null
          const clawedBack = status === 'reversed' || status === 'clawback_owed'
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
              ...(clawedBack
                ? { paid_after_clawback: true, paid_after_clawback_at: new Date().toISOString() }
                : { status: 'paid', error_code: null, error_message: null }),
              paid_at: FieldValue.serverTimestamp(),
              attempts: FieldValue.increment(1),
            },
            { merge: true }
          )
          return clawedBack
        })

        if (reversedMidFlight) {
          await reportFailure(
            'payout-clawback-race',
            new Error(
              `A commission transfer completed for a share that was clawed back mid-run — $${(actualAmount / 100).toFixed(2)} left the platform for a reversed sale`
            ),
            { service, payee_user_id: payeeUserId, source_payment: sourcePaymentId, transfer_id: transferId }
          ).catch(() => {})
        }
        return 'recorded'
      } catch (err) {
        lastError = err
        // Contention and UNAVAILABLE are exactly what a retry fixes; a permanent
        // error just costs three quick attempts before the alert below.
        if (attempt < LEDGER_WRITE_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
        }
      }
    }

    const lastErrorText = String((lastError as any)?.message ?? lastError).slice(0, 300)

    // Last-ditch breadcrumb. A plain merge is a different, simpler operation than
    // the transaction that just failed (no read, no contention retry), so it can
    // survive when that did not. It deliberately does NOT set `status` — promoting
    // to 'paid' needs the clawback re-read this path could not complete — but a
    // still-`held` row carrying a stripe_transfer_id is the evidence a human needs
    // to reconcile it against Stripe by hand.
    await ledgerRef
      .set(
        {
          stripe_transfer_id: transferId,
          ledger_write_failed_at: FieldValue.serverTimestamp(),
          error_code: 'ledger_write_failed',
          error_message: lastErrorText,
        },
        { merge: true }
      )
      .catch(() => {})

    // Nothing repairs this automatically: Stripe has moved the money and Firestore
    // will not say so. Page a human with everything needed to fix the row by hand.
    // Its own alert source keeps this out of the `payout-transfer` dedupe bucket,
    // which a noisy run could otherwise use up (3 emails per 6h per source).
    await reportFailure(
      'payout-ledger-write',
      new Error(
        `Stripe transfer ${transferId} sent $${(actualAmount / 100).toFixed(2)} but its ledger row could not be written after ${LEDGER_WRITE_ATTEMPTS} attempts — the share still reads as unpaid in Firestore while the money has left the platform`
      ),
      {
        ledger_path: ledgerRef.path,
        transfer_id: transferId,
        amount_cents: actualAmount,
        service,
        role,
        payee_user_id: payeeUserId,
        source_payment: sourcePaymentId,
        last_error: lastErrorText,
      }
    ).catch(() => {})
    return 'unrecorded'
  }

  // One place that turns "the transfer went through" into a caller-visible status,
  // so neither the adopt path nor the create path can report a clean `paid` for a
  // share whose ledger row was never written.
  const settled = (
    transferId: string,
    actualAmount: number,
    recorded: 'recorded' | 'unrecorded'
  ) =>
    ({
      status: recorded === 'recorded' ? ('paid' as const) : ('paid_unrecorded' as const),
      amount: actualAmount,
      transferId,
      ...(recorded === 'recorded' ? {} : { error: 'ledger_write_failed' }),
    })

  // Anti-double-pay backstop: if a transfer for this exact share already exists on
  // Stripe — a prior attempt committed but its ledger row was lost, or the
  // idempotency key has since expired (>24h) — adopt it instead of creating a
  // second transfer. The lookup result is captured here and acted on OUTSIDE the
  // try so a transient recordPaid error can never fall through to a second create.
  let adopted: { id: string; amount: number } | null = null
  let lookup: PriorTransferLookup = transferGroup ? 'none' : 'unchecked'
  let lookupError: unknown = null
  if (transferGroup) {
    try {
      const prior = await stripe.transfers.list({ transfer_group: transferGroup, limit: 1 })
      const t = prior.data[0]
      if (t) {
        adopted = { id: t.id, amount: t.amount }
        lookup = 'found'
      }
    } catch (err) {
      // This used to be a bare `catch {}` commented as "best-effort" — but the
      // shared idempotency key it deferred to only guards the first ~24h, so past
      // that window a swallowed lookup error fell straight through to a second
      // stripe.transfers.create. See mayCreateTransfer.
      lookup = 'failed'
      lookupError = err
    }
  }
  if (adopted) {
    return settled(adopted.id, adopted.amount, await recordPaid(adopted.id, adopted.amount))
  }
  if (!mayCreateTransfer(lookup)) {
    // Deliberately does NOT touch `status`: a `held` row must stay held for the
    // next cycle, and a `failed` / `skipped_no_connected_account` row must stay
    // retryable by reconcileFailedTransfers. Only diagnostics are written, and
    // recordPaid clears them on the eventual success.
    await ledgerRef
      .set(
        {
          error_code: 'prior_transfer_lookup_failed',
          error_message: String((lookupError as any)?.message ?? lookupError).slice(0, 300),
          last_attempt_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {})
    await reportFailure('payout-transfer-lookup', lookupError, {
      service,
      payee_user_id: payeeUserId,
      source_payment: sourcePaymentId,
      transfer_group: transferGroup,
    }).catch(() => {})
    return { status: 'failed', error: 'prior_transfer_lookup_failed' }
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

  return settled(transfer.id, amount, await recordPaid(transfer.id, amount))
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

    // A PARTIAL refund shrinks a share in place and leaves it `held` — so the
    // guard above, which only skips rows that are no longer `held`, does not
    // protect it. Without this, a redelivered event (Stripe is at-least-once,
    // and reconcile-orders deliberately replays) would write `amount` back to
    // the full split and silently hand the rep commission on money that had
    // been returned to the customer. Re-apply the recorded ratio instead of
    // overwriting it: recompute from the authoritative split, then take the
    // same proportion off again, which lands on the same figure every time.
    const refundedRatio = Number(existingData?.refunded_ratio) || 0
    const accruedAmount =
      refundedRatio > 0
        ? Math.max(0, Math.round(share.amountCents * (1 - refundedRatio)))
        : share.amountCents

    await ledgerRef.set(
      {
        payee_user_id: share.payeeUserId,
        service,
        role: share.role,
        percent: share.percent,
        amount: accruedAmount,
        // Keep the pre-refund figure so a later, larger refund still divides the
        // original rather than an already-reduced number.
        ...(refundedRatio > 0 ? { original_amount: share.amountCents } : {}),
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
  invalid: number
  // Shares where Stripe moved the money but the ledger write failed anyway. They
  // are NOT in `paid` (Firestore still reads them as unpaid) but their cents ARE
  // in `amount_paid`, which reports what actually left the platform. Any non-zero
  // value here means a `payout-ledger-write` alert is waiting on a human.
  unrecorded: number
  amount_paid: number
  truncated: boolean
  indexed: boolean
}> {
  const { stripe, limit = 200, dryRun = false } = params
  const now = params.now ? new Date(params.now) : new Date()
  const nowIso = now.toISOString()

  // Oldest-eligible first, paged, so a growing backlog can never starve a
  // matured share: every run drains from the front of the eligibility queue.
  // The old scan was `status == 'held'` with an unordered limit(200) — with
  // commission_mode 'residual' accruing a share on EVERY renewal, not-yet-due
  // rows consumed the budget and, past 200 held rows, a doc-id-determined
  // subset was re-scanned forever while matured commission was never examined.
  let processedDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
  let indexedQueryWorked = true
  try {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null
    while (processedDocs.length < limit) {
      let pageQuery = adminDb
        .collection('transfers')
        .where('status', '==', 'held')
        .where('eligible_at', '<=', nowIso)
        .orderBy('eligible_at', 'asc')
        .limit(Math.min(200, limit - processedDocs.length))
      if (cursor) pageQuery = pageQuery.startAfter(cursor)
      const page = await pageQuery.get()
      if (page.empty) break
      processedDocs.push(...page.docs)
      cursor = page.docs[page.docs.length - 1]
      if (page.docs.length < 200) break
    }
  } catch (error) {
    // The composite (status, eligible_at) index may not be deployed yet. Fall
    // back to the old unordered scan so payouts NEVER halt on an index gap —
    // but tell ops, because the fallback can starve above `limit` rows.
    indexedQueryWorked = false
    await reportFailure('payout-cycle-index', error, {
      hint: 'deploy firestore.indexes.json (transfers status+eligible_at)',
    }).catch(() => {})
    const snap = await adminDb
      .collection('transfers')
      .where('status', '==', 'held')
      .limit(limit)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    processedDocs = snap.docs
  }

  const summary = {
    scanned: processedDocs.length,
    due: 0,
    paid: 0,
    failed: 0,
    no_bank: 0,
    invalid: 0,
    unrecorded: 0,
    amount_paid: 0,
    truncated: processedDocs.length >= limit,
    indexed: indexedQueryWorked,
  }

  if (summary.truncated && !dryRun) {
    await reportFailure(
      'payout-cycle-truncated',
      new Error(
        `Payout cycle hit its ${limit}-row window with matured shares possibly remaining — run again or raise ?limit=`
      ),
      { scanned: processedDocs.length }
    ).catch(() => {})
  }

  for (const doc of processedDocs) {
    const row = doc.data() as any
    // Defense in depth: the indexed path only returns matured rows, but the
    // fallback path (and clock skew) still need the predicate.
    if (!isCommissionDue(row, now)) continue
    summary.due++

    const payeeUserId: string | undefined = row.payee_user_id
    const service: string = row.service
    const amount = Math.max(0, Math.round(Number(row.amount) || 0))
    if (!payeeUserId || !service || amount <= 0) {
      // Retire malformed rows instead of re-scanning them every cycle forever
      // — same pattern reconcileFailedTransfers uses for its scan window.
      if (!dryRun) await doc.ref.set({ status: 'skipped_invalid' }, { merge: true }).catch(() => {})
      summary.invalid++
      continue
    }
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
    } else if (result.status === 'paid_unrecorded') {
      // The money left but the row still says `held`, so reporting this as `paid`
      // would make the run look clean while finance and MyEarnings quietly
      // disagree with Stripe. Counted separately, and its cents still count as
      // money out of the platform because that is what happened.
      summary.unrecorded++
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

// Every accrued share for one payment, by either handle. `source_payment` is the
// checkout session (what payoutSplit stores for the originating sale) and
// `source_transaction` is the charge id — the only handle that works for
// SELF-SERVE sales, which have no sales_orders row to recover a session from.
// The two lookups can return the same row, so results are deduped by path.
async function findCommissionShares(params: {
  sourcePaymentId?: string | null
  sourceTransaction?: string | null
}): Promise<{ byPath: Map<string, FirebaseFirestore.QueryDocumentSnapshot>; lookupFailed: boolean }> {
  // A failed lookup used to be swallowed into an empty result, which is
  // indistinguishable from "this sale earned no commission" — so a Firestore
  // blip during a refund meant the clawback reversed nothing, reported success,
  // and the rep kept commission on money that had gone back to the customer.
  // Silence was the worst possible answer here, so the failure is now carried
  // out and the caller alerts on it.
  let lookupFailed = false
  const run = async (field: string, value: string) => {
    try {
      return await adminDb.collection('transfers').where(field, '==', value).get()
    } catch {
      lookupFailed = true
      return { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }
    }
  }

  const queries: Promise<
    FirebaseFirestore.QuerySnapshot | { docs: FirebaseFirestore.QueryDocumentSnapshot[] }
  >[] = []
  if (params.sourcePaymentId) queries.push(run('source_payment', params.sourcePaymentId))
  if (params.sourceTransaction) queries.push(run('source_transaction', params.sourceTransaction))

  const snaps = await Promise.all(queries)
  const byPath = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  for (const snap of snaps) {
    for (const doc of snap.docs) byPath.set(doc.ref.path, doc)
  }
  return { byPath, lookupFailed }
}

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

  const { byPath, lookupFailed } = await findCommissionShares({ sourcePaymentId, sourceTransaction })

  // Could not read the ledger, so "nothing to reverse" is unknowable and an
  // empty result is indistinguishable from "this sale earned no commission".
  // An unreversed clawback is money the platform refunded AND paid out.
  if (lookupFailed) {
    await reportFailure(
      'commission-clawback-lookup',
      new Error(
        `Could not read the commission ledger during a ${reason}. Any shares for this payment were NOT reversed — check them by hand.`
      ),
      { source_payment: sourcePaymentId, source_transaction: sourceTransaction, reason }
    ).catch(() => {})
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

// Proportionally shrinks accrued commission after a PARTIAL refund.
//
// The full-refund path (clawbackCommission) reverses a share outright. A partial
// refund used to do nothing but raise an alert, so a rep kept commission
// calculated on the full price of a sale the customer only half paid for — and
// at 65-70% split rates, refunding much more than a third of a sale made the
// transaction net-negative for the platform.
//
// Idempotent by construction: `amount_refunded` is Stripe's CUMULATIVE total and
// each share's target is derived from its stamped `original_amount`, so
// re-delivering the same event, or a second refund on the same charge, converges
// on the correct figure instead of compounding (see partialRefundPlan).
export async function reduceCommissionForPartialRefund(params: {
  sourcePaymentId?: string | null
  sourceTransaction?: string | null
  chargeAmount: number
  amountRefunded: number
  reason: 'refund' | 'dispute'
}): Promise<{
  reduced: number
  reversed: number
  owed: number
  amount_reduced: number
  amount_owed: number
}> {
  const { sourcePaymentId, sourceTransaction, chargeAmount, amountRefunded, reason } = params
  const summary = { reduced: 0, reversed: 0, owed: 0, amount_reduced: 0, amount_owed: 0 }
  if (!sourcePaymentId && !sourceTransaction) return summary

  const { byPath, lookupFailed } = await findCommissionShares({ sourcePaymentId, sourceTransaction })
  const now = new Date().toISOString()

  if (lookupFailed) {
    await reportFailure(
      'commission-clawback-lookup',
      new Error(
        `Could not read the commission ledger during a partial ${reason}. Shares for this payment were NOT reduced — check them by hand.`
      ),
      { source_payment: sourcePaymentId, source_transaction: sourceTransaction, reason }
    ).catch(() => {})
  }

  for (const doc of byPath.values()) {
    const row = doc.data() as any
    const plan = partialRefundPlan(row, { amount: chargeAmount, amount_refunded: amountRefunded })
    if (!plan) continue

    if (plan.action === 'owe') {
      // The money is already in the rep's bank. Leave the row `paid` — that is
      // what actually happened — and record the debt on it. Flipping the whole
      // share to `clawback_owed` would overstate it as if all of it came back.
      await doc.ref.set(
        {
          clawback_owed_amount: plan.owedAmount,
          clawback_reason: reason,
          clawback_at: now,
          refunded_ratio: plan.refundedRatio,
          original_amount: plan.originalAmount,
        },
        { merge: true }
      )
      summary.owed++
      summary.amount_owed += plan.owedAmount
      continue
    }

    await doc.ref.set(
      {
        // Stamped once and never recomputed, so later refunds on the same charge
        // divide the original rather than an already-reduced figure.
        original_amount: plan.originalAmount,
        amount: plan.targetAmount,
        refunded_ratio: plan.refundedRatio,
        partial_refund_at: now,
        ...(plan.action === 'reverse'
          ? { status: 'reversed', clawback_reason: reason, clawback_at: now }
          : {}),
      },
      { merge: true }
    )
    if (plan.action === 'reverse') summary.reversed++
    else summary.reduced++
    summary.amount_reduced += plan.reduceBy
  }

  // A debt against an already-transferred share is not something the code can
  // settle — runPayoutCycle only reads `held` rows and never nets a debt off a
  // future cycle. It is a conversation an operator has to have, so page them.
  if (summary.owed > 0) {
    await reportFailure(
      'commission-partial-refund',
      new Error(
        `A partial refund reduced ${summary.owed} already-paid commission share(s) by $${(summary.amount_owed / 100).toFixed(2)} — that money has already been transferred and must be netted off or collected manually`
      ),
      {
        source_payment: sourcePaymentId,
        source_transaction: sourceTransaction,
        reason,
        charge_amount: chargeAmount,
        amount_refunded: amountRefunded,
      }
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
}): Promise<{
  scanned: number
  paid: number
  still_failing: number
  superseded: number
  skipped: number
  // Transfers that went through but whose ledger row could not be written — see
  // the same field on runPayoutCycle. Non-zero means a human is being paged.
  unrecorded: number
}> {
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
  let unrecorded = 0

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
    else if (res.status === 'paid_unrecorded') unrecorded++ // money moved, ledger didn't record it
    else if (res.status === 'in_progress') skipped++ // another request is creating it
    else stillFailing++
  }

  // Clear the ops alert once nothing is left failing in this batch. `unrecorded`
  // blocks the all-clear on purpose: a transfer whose ledger row was never written
  // is an open money discrepancy, and announcing recovery would bury it.
  if (!dryRun && paid > 0 && stillFailing === 0 && unrecorded === 0) {
    await reportSuccess('payout-transfer').catch(() => {})
  }

  return { scanned: snap.docs.length, paid, still_failing: stillFailing, superseded, skipped, unrecorded }
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
