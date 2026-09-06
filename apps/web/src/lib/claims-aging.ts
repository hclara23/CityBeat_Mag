// How long a PAID directory claim has been sitting unapproved.
//
// A paid claim lands in `pending_approval` and waits for a human to confirm the
// claimant really represents the business. That review is correct and deliberate —
// it is what stops someone buying the Sponsored slot on a business they have
// nothing to do with. But it is performed by hand, by one person, with
// auto-approval off by default, and nothing anywhere notices when it does not
// happen. The customer's card is charged the moment they check out; if the
// operator is ill, travelling, or simply busy for two weeks, that business has
// paid and received nothing, and the only surface showing it is a count in a
// weekly digest.
//
// This is the pure rule. It says who is overdue and how badly, so a cron can page
// someone before a paying customer has to.

/** Long enough that a busy week does not page anyone, short enough that a paying
 *  customer is never left wondering. */
export const CLAIM_REVIEW_TARGET_HOURS = 48
/** Past this, it is no longer a backlog — it is a customer being ignored. */
export const CLAIM_REVIEW_BREACH_HOURS = 120

export type PendingClaim = {
  id: string
  name?: unknown
  claim_status?: unknown
  owner_id?: unknown
  contact_email?: unknown
  pending_tier?: unknown
  tier?: unknown
  stripe_subscription_id?: unknown
  claimed_at?: unknown
  created_at?: unknown
  updated_at?: unknown
}

export type AgingClaim = {
  id: string
  name: string
  hours_waiting: number
  paid: boolean
  breached: boolean
  contact_email: string | null
  owner_id: string | null
}

function toMillis(value: unknown): number | null {
  if (!value) return null
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object') {
    const v = value as any
    if (typeof v.toDate === 'function') {
      const d = v.toDate()
      return d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : null
    }
    if (typeof v._seconds === 'number') return v._seconds * 1000
  }
  return null
}

/** A claim is PAID if money is attached to it: a live subscription, or a tier the
 *  customer bought and has not been granted yet. A free Basic claim waiting for
 *  review costs the claimant nothing, so it is not what we page about. */
export function claimIsPaid(claim: PendingClaim): boolean {
  if (typeof claim.stripe_subscription_id === 'string' && claim.stripe_subscription_id) return true
  const pending = typeof claim.pending_tier === 'string' ? claim.pending_tier : ''
  return pending === 'premium' || pending === 'featured'
}

/**
 * The paid claims that have waited too long, worst first.
 *
 * Deliberately measured from `claimed_at` and NOT from `updated_at`: any admin
 * action that touches the document would otherwise reset the clock and hide a
 * claim that has genuinely been waiting for weeks.
 */
export function agingPaidClaims(
  claims: PendingClaim[],
  now: Date | number = new Date(),
  targetHours: number = CLAIM_REVIEW_TARGET_HOURS
): AgingClaim[] {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  const out: AgingClaim[] = []

  for (const claim of claims) {
    if (claim.claim_status !== 'pending_approval') continue
    if (!claimIsPaid(claim)) continue

    const startedAt = toMillis(claim.claimed_at) ?? toMillis(claim.created_at)
    // An undateable paid claim is reported rather than skipped: we cannot show how
    // long it has waited, but "we do not know" must not read as "it is fine".
    const hours = startedAt === null ? Number.POSITIVE_INFINITY : (nowMs - startedAt) / 3_600_000
    if (hours < targetHours) continue

    out.push({
      id: claim.id,
      name: typeof claim.name === 'string' && claim.name ? claim.name : claim.id,
      hours_waiting: Number.isFinite(hours) ? Math.floor(hours) : -1,
      paid: true,
      breached: hours >= CLAIM_REVIEW_BREACH_HOURS,
      contact_email: typeof claim.contact_email === 'string' ? claim.contact_email : null,
      owner_id: typeof claim.owner_id === 'string' ? claim.owner_id : null,
    })
  }

  // Unknown-age first (hours_waiting -1 sorts oddly otherwise), then longest wait.
  return out.sort((a, b) => {
    if (a.hours_waiting === -1 && b.hours_waiting !== -1) return -1
    if (b.hours_waiting === -1 && a.hours_waiting !== -1) return 1
    return b.hours_waiting - a.hours_waiting
  })
}

/** One line an operator can act on without opening a dashboard. */
export function agingClaimsSummary(aging: AgingClaim[]): string {
  if (aging.length === 0) return 'No paid claims are overdue for review.'
  const breached = aging.filter((c) => c.breached).length
  const worst = aging[0]
  const worstAge = worst.hours_waiting === -1 ? 'an unknown time' : `${Math.floor(worst.hours_waiting / 24)}d`
  return (
    `${aging.length} paid directory claim(s) are waiting on approval` +
    (breached ? `, ${breached} of them past ${CLAIM_REVIEW_BREACH_HOURS / 24} days` : '') +
    `. Longest: "${worst.name}" (${worstAge}). These customers have been charged and have not received what they paid for.`
  )
}
