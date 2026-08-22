// Pure multi-party commission-split logic (no Stripe/Firestore imports, so it's
// unit-testable). The engine in lib/payouts.ts wraps this with the actual
// transfers + ledger.
//
// Model: the EDITOR earns a share of every sale; the SELLING REP earns a share of
// sales they make. Godmode can override what ANY individual earns per product
// bucket — those overrides win over the channel defaults below, and the platform
// keeps whatever remains (never more than 100% is ever transferred out).

export type SplitBucket = 'directory' | 'ads'
export type SplitChannel = 'editor' | 'rep' | 'autonomous'

// { editor%, rep% } transferred out; the platform (App + Developer) keeps the
// rest. Channel is derived from who sold it.
export const SPLIT_RATES: Record<SplitBucket, Record<SplitChannel, { editor: number; rep: number }>> = {
  directory: {
    editor: { editor: 45, rep: 0 },
    rep: { editor: 25, rep: 40 },
    autonomous: { editor: 40, rep: 0 },
  },
  ads: {
    editor: { editor: 65, rep: 0 },
    rep: { editor: 20, rep: 50 },
    autonomous: { editor: 0, rep: 0 },
  },
}

// Directory is its own bucket; everything else (ad_campaign, sponsored_post,
// jobs, event features, custom field sales) follows the ads split.
export function bucketForService(service: string): SplitBucket {
  return service === 'directory' ? 'directory' : 'ads'
}

export type SplitShare = { payeeUserId: string; role: 'editor' | 'rep'; percent: number }

// Per-individual override: what this person earns (0–100) on a directory / ads
// sale where they are the payee (the editor, or the selling rep). `label` is a
// human name for the godmode UI only.
export type SplitOverride = { label?: string; directory?: number; ads?: number }
export type SplitOverrides = Record<string, SplitOverride>

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// Cap cumulative payout at 100% (in order) so a misconfigured override set can
// never transfer out more than the gross payment — the platform never goes
// negative. Shares that would exceed 100% are trimmed/dropped.
export function capShares(shares: SplitShare[]): SplitShare[] {
  let running = 0
  const out: SplitShare[] = []
  for (const s of shares) {
    const remaining = Math.max(0, 100 - running)
    const pct = Math.min(clampPct(s.percent), remaining)
    if (pct > 0) {
      out.push({ ...s, percent: pct })
      running += pct
    }
  }
  return out
}

// Compute the transfers for one sale. A per-individual override wins over the
// channel default: the editor's override applies on every sale (even where the
// default was 0), and a rep's override applies to the sales that rep makes.
export function computeSplit(
  service: string,
  sellerUserId: string | null,
  editorUserId: string,
  overrides?: SplitOverrides
): SplitShare[] {
  const bucket = bucketForService(service)
  const channel: SplitChannel = !sellerUserId
    ? 'autonomous'
    : sellerUserId === editorUserId
      ? 'editor'
      : 'rep'
  const rates = SPLIT_RATES[bucket][channel]
  const ov = overrides || {}
  const shares: SplitShare[] = []

  // Editor share (override can raise, lower, or create it).
  if (editorUserId) {
    const editorPct = clampPct(numOr(ov[editorUserId]?.[bucket], rates.editor))
    if (editorPct > 0) shares.push({ payeeUserId: editorUserId, role: 'editor', percent: editorPct })
  }
  // Rep share — only when a DIFFERENT person sold it. Their override applies to
  // the sales they personally make.
  if (sellerUserId && sellerUserId !== editorUserId) {
    const repPct = clampPct(numOr(ov[sellerUserId]?.[bucket], rates.rep))
    if (repPct > 0) shares.push({ payeeUserId: sellerUserId, role: 'rep', percent: repPct })
  }

  return capShares(shares)
}

// ---- transfer request (pure) -----------------------------------------------
// Building the Stripe transfer params is money-critical, so it lives here (pure,
// unit-tested) rather than inline in the I/O layer.

// Stable idempotency key for a payout. Stripe delivers webhooks at-least-once and
// the reconcile cron may retry, so the SAME (service, payee, payment) must always
// map to the same key — that guarantees at most one transfer per share per sale.
// Null when there's no source payment (a flat/manual payout is not deduped here).
export function transferIdempotencyKey(
  service: string,
  payeeUserId: string,
  sourcePaymentId?: string | null
): string | null {
  if (!sourcePaymentId) return null
  return `payout:${service}:${payeeUserId}:${sourcePaymentId}`
}

// Build the params (and idempotency key) for stripe.transfers.create.
// `sourceTransaction` (a charge id) is the fix for the "insufficient funds" class
// of failure: with it, Stripe accepts the transfer immediately and draws it from
// that specific charge as soon as the charge settles — even while the funds are
// still `pending`, and regardless of the platform's automatic-payout schedule.
// Without it, the transfer needs available balance at call time (the old, fragile
// behavior), so it's included only when a charge id is known.
//
// `transfer_group` is set to the stable key so a payout's transfer can be found
// again on Stripe (transfers.list by group) even if the local ledger row was lost
// — the anti-double-pay backstop when the idempotency key has expired.
//
// The idempotency key is the STABLE per-share key on EVERY attempt (first webhook
// delivery, retries, and the reconcile pass). Sharing it means Stripe itself
// collapses any concurrent create of the same share into a single transfer, which
// is the airtight guard against double-paying real money. The cost is that if
// Stripe has cached a failure under the key, a reconcile retry within ~24h replays
// that error and only succeeds once the key expires — an acceptable recovery
// delay (funds usually settle in ~2 days anyway, and source_transaction makes the
// common failure not happen at all). Never trade this dedup for faster recovery.
export function buildTransferRequest(input: {
  amount: number
  currency: string
  destination: string
  service: string
  payeeUserId: string
  sourcePaymentId?: string | null
  sourceTransaction?: string | null
}): { params: Record<string, unknown>; idempotencyKey: string | null; transferGroup: string | null } {
  const stableKey = transferIdempotencyKey(input.service, input.payeeUserId, input.sourcePaymentId)
  const params: Record<string, unknown> = {
    amount: input.amount,
    currency: input.currency,
    destination: input.destination,
    metadata: {
      service: input.service,
      payee_user_id: input.payeeUserId,
      source_payment: input.sourcePaymentId || '',
    },
  }
  if (stableKey) params.transfer_group = stableKey
  if (input.sourceTransaction) params.source_transaction = input.sourceTransaction
  return { params, idempotencyKey: stableKey, transferGroup: stableKey }
}

// Deterministic Firestore document id for a share's ledger row, so every write for
// the same share (skipped → failed → paid, and any duplicate webhook delivery)
// lands on ONE document instead of appending duplicate rows that would double-count
// in finance rollups. Null when there's no stable key (e.g. flat manual payouts,
// which keep auto-ids). '/' is the only character Firestore forbids in an id.
export function ledgerDocId(
  service: string,
  payeeUserId: string,
  sourcePaymentId?: string | null
): string | null {
  const key = transferIdempotencyKey(service, payeeUserId, sourcePaymentId)
  return key ? key.replace(/\//g, '_') : null
}

// Split a gross payment into integer-cent shares that NEVER sum to more than
// `transferableBase`. Each share is round(amountTotal * pct / 100), then clamped
// to whatever cents remain — so per-share rounding (two .5c shares both rounding
// up) and near-100% configs can't push the total over the charge's transferable
// amount, which would make the last Stripe transfer fail. Order-preserving, like
// capShares: earlier shares are paid in full and the platform keeps the remainder
// (incl. the Stripe fee headroom baked into a net-of-fees base).
export function allocateShareCents(
  shares: SplitShare[],
  amountTotal: number,
  transferableBase: number
): Array<SplitShare & { amountCents: number }> {
  const base = Math.max(0, Math.floor(Number.isFinite(transferableBase) ? transferableBase : amountTotal))
  let remaining = base
  const out: Array<SplitShare & { amountCents: number }> = []
  for (const s of shares) {
    const ideal = Math.round((amountTotal * clampPct(s.percent)) / 100)
    const cents = Math.max(0, Math.min(ideal, remaining))
    remaining -= cents
    out.push({ ...s, amountCents: cents })
  }
  return out
}

// Sanitize a godmode-submitted override map: plausible UIDs only, percents
// clamped to 0–100 integers, label bounded, and entries that set no percent
// dropped.
export function normalizeSplitOverrides(input: unknown): SplitOverrides {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: SplitOverrides = {}
  for (const [uid, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) continue
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const r = raw as Record<string, unknown>
    const entry: SplitOverride = {}
    if (typeof r.label === 'string' && r.label.trim()) entry.label = r.label.trim().slice(0, 80)
    if (typeof r.directory === 'number' && Number.isFinite(r.directory)) entry.directory = clampPct(r.directory)
    if (typeof r.ads === 'number' && Number.isFinite(r.ads)) entry.ads = clampPct(r.ads)
    if ('directory' in entry || 'ads' in entry) out[uid] = entry
  }
  return out
}
