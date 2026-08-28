// Commission accrual schedule (pure, unit-tested — no I/O).
//
// Commission is NOT paid the moment a sale clears. Money moves in three steps:
//
//   1. ACCRUE   — at checkout.session.completed each share is written to the
//                 `transfers` ledger as `held`. Nothing leaves the platform.
//   2. MATURE   — COMMISSION_HOLD_DAYS (7) after the purchase the share becomes
//                 eligible. The hold is the refund/change-of-mind window: if the
//                 customer reverses inside it, the commission is cancelled
//                 outright and no money was ever sent.
//   3. PAY      — the payout cycle runs on the 1st and the 15th and transfers
//                 every share that is both `held` and matured.
//
// Reps are told this explicitly (see PAYOUT_POLICY_* below, rendered on the
// Sales Desk and in My Earnings), including that a refund or cancellation after
// payment claws the commission back.
//
// El Paso local time (America/Denver) is the business calendar everywhere in
// this codebase — see listing-content.ts elPasoDayKey and referrals.ts — so
// cycle dates are local dates, not UTC ones. A payout "on the 1st" must mean
// the 1st in El Paso, not 5pm on the 31st.

export const COMMISSION_HOLD_DAYS = 7
export const PAYOUT_CYCLE_DAYS = [1, 15] as const
export const BUSINESS_TIME_ZONE = 'America/Denver'

export type CommissionStatus =
  | 'held'
  | 'paid'
  | 'failed'
  | 'skipped_no_connected_account'
  | 'reversed'
  | 'clawback_owed'

function assertValid(date: Date, label: string): Date {
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid ${label} date`)
  return date
}

/** Local Y/M/D in the business time zone (DST-aware via Intl). */
export function localDateParts(
  value: Date | string,
  timeZone = BUSINESS_TIME_ZONE
): { year: number; month: number; day: number } {
  const date = assertValid(new Date(value), 'commission')
  // en-CA formats as YYYY-MM-DD, which parses without locale ambiguity.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .split('-')
    .map(Number)
  return { year, month, day }
}

const isoDay = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/**
 * When a share stops being refund-risk and becomes payable.
 * Returned as an ISO timestamp so it can be compared directly against `now`.
 */
export function commissionEligibleAt(
  saleAt: Date | string,
  holdDays: number = COMMISSION_HOLD_DAYS
): string {
  const date = assertValid(new Date(saleAt), 'sale')
  const days = Math.max(0, Math.floor(holdDays))
  return new Date(date.getTime() + days * 86400000).toISOString()
}

/**
 * The next payout cycle date (1st or 15th) falling ON or AFTER the given moment,
 * as a local YYYY-MM-DD date. Used to tell a rep exactly when a matured
 * commission will actually land.
 */
export function nextPayoutRunOn(
  from: Date | string,
  timeZone = BUSINESS_TIME_ZONE
): string {
  const { year, month, day } = localDateParts(from, timeZone)
  if (day <= 1) return isoDay(year, month, 1)
  if (day <= 15) return isoDay(year, month, 15)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return isoDay(nextYear, nextMonth, 1)
}

/** True on the 1st and the 15th, in business-local time. */
export function isPayoutCycleDay(
  value: Date | string,
  timeZone = BUSINESS_TIME_ZONE
): boolean {
  const { day } = localDateParts(value, timeZone)
  return (PAYOUT_CYCLE_DAYS as readonly number[]).includes(day)
}

/**
 * The date a rep will actually be paid for a sale made at `saleAt`:
 * hold out the refund window, then wait for the next cycle.
 */
export function commissionPayoutDate(
  saleAt: Date | string,
  holdDays: number = COMMISSION_HOLD_DAYS,
  timeZone = BUSINESS_TIME_ZONE
): string {
  return nextPayoutRunOn(commissionEligibleAt(saleAt, holdDays), timeZone)
}

/** A held share whose refund window has closed — the payout cycle pays these. */
export function isCommissionDue(
  row: { status?: unknown; eligible_at?: unknown },
  now: Date | string = new Date()
): boolean {
  if (row.status !== 'held') return false
  if (typeof row.eligible_at !== 'string' || !row.eligible_at) return false
  const eligible = new Date(row.eligible_at)
  if (!Number.isFinite(eligible.getTime())) return false
  return eligible.getTime() <= assertValid(new Date(now), 'now').getTime()
}

/**
 * What a refund/cancellation/chargeback does to a share.
 * Reversing something never paid is free; reversing something already paid
 * creates a debt that nets against the rep's future commission.
 * Returns null when the share is already resolved (idempotent).
 */
export function clawbackTransition(status: unknown): {
  next: CommissionStatus
  alreadyPaid: boolean
} | null {
  switch (status) {
    case 'held':
    case 'failed':
    case 'skipped_no_connected_account':
      return { next: 'reversed', alreadyPaid: false }
    case 'paid':
      return { next: 'clawback_owed', alreadyPaid: true }
    default:
      // 'reversed' / 'clawback_owed' / unknown — nothing further to do.
      return null
  }
}

/** Rep-facing state for one ledger row, for My Earnings / the Sales Desk. */
export function commissionDisplayState(
  row: { status?: unknown; eligible_at?: unknown },
  now: Date | string = new Date()
): {
  state: 'held' | 'due' | 'paid' | 'failed' | 'no_bank' | 'reversed' | 'clawback_owed'
  payoutDate: string | null
} {
  if (row.status === 'paid') return { state: 'paid', payoutDate: null }
  if (row.status === 'reversed') return { state: 'reversed', payoutDate: null }
  if (row.status === 'clawback_owed') return { state: 'clawback_owed', payoutDate: null }
  if (row.status === 'skipped_no_connected_account') return { state: 'no_bank', payoutDate: null }

  const eligibleAt = typeof row.eligible_at === 'string' ? row.eligible_at : null
  const payoutDate = eligibleAt ? nextPayoutRunOn(eligibleAt) : null
  if (row.status === 'failed') return { state: 'failed', payoutDate }
  if (isCommissionDue(row, now)) return { state: 'due', payoutDate }
  return { state: 'held', payoutDate }
}

/** Sum of shares a payee is actually owed (matured but not yet paid). */
export function totalByState(
  rows: Array<{ status?: unknown; eligible_at?: unknown; amount?: unknown }>,
  now: Date | string = new Date()
): { held: number; due: number; paid: number; owed_back: number } {
  const totals = { held: 0, due: 0, paid: 0, owed_back: 0 }
  for (const row of rows) {
    const cents = Math.max(0, Math.round(Number(row.amount) || 0))
    if (!cents) continue
    const { state } = commissionDisplayState(row, now)
    if (state === 'paid') totals.paid += cents
    // `no_bank` is money the rep has EARNED — it is only waiting on them to
    // finish connecting a bank, and reconcileFailedTransfers pays it once they
    // do. Omitting it made a share the rep had been watching as "On hold"
    // vanish from their dashboard entirely the moment a payout cycle tried and
    // found no account, leaving MyEarnings showing "No commissions yet".
    else if (state === 'due' || state === 'failed' || state === 'no_bank') totals.due += cents
    else if (state === 'held') totals.held += cents
    else if (state === 'clawback_owed') totals.owed_back += cents
  }
  return totals
}

// Rep-facing policy copy. Kept here so the Sales Desk, My Earnings, and any
// future rep onboarding all state the same terms — a rep must never be
// surprised by a clawback.
// Rep-facing terms. These must describe what the code ACTUALLY does — an
// earlier draft promised that an already-paid clawback is "deducted from your
// next payout", but nothing nets a debt off a future cycle: runPayoutCycle only
// reads `held` rows and never looks at `clawback_owed`. Recovery is a manual
// conversation an operator has (clawbackCommission alerts them), so that is
// what the policy says.
export const PAYOUT_POLICY_EN = {
  headline: 'How and when you get paid',
  hold: `Commission is held for ${COMMISSION_HOLD_DAYS} days after the customer pays. This is the refund window.`,
  cycle: 'After that, it is paid on the next payout cycle — the 1st and the 15th of each month.',
  clawback:
    'If the customer refunds or disputes the charge, the commission is reversed. If it had not been paid out yet, it simply never is. If it had, we will contact you to settle it.',
}

export const PAYOUT_POLICY_ES = {
  headline: 'Cómo y cuándo te pagamos',
  hold: `La comisión se retiene ${COMMISSION_HOLD_DAYS} días después de que el cliente paga. Es el periodo de reembolso.`,
  cycle: 'Después se paga en el siguiente ciclo de pago: el día 1 y el día 15 de cada mes.',
  clawback:
    'Si el cliente pide reembolso o disputa el cargo, la comisión se revierte. Si aún no se había pagado, simplemente no se paga. Si ya se te había pagado, te contactamos para resolverlo.',
}
