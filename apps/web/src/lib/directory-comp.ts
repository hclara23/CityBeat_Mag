// Complimentary ("comp") tier grants: a listing given Premium for free for a
// fixed period, with no Stripe subscription behind it. Pure (no I/O) so the
// rules are unit-tested; the daily /api/cron/comp-expiry route applies them.
//
// Why this needs its own fields rather than just `tier: 'premium'`:
//   - Everything else treats a Premium tier with no subscription as permanent,
//     so a bare grant would never end.
//   - The claim flow drops an unpaid listing to Basic at approval
//     (directoryClaimPendingTier → 'basic' when there is no subscription). The
//     promotion asks businesses to claim their listing, so without this the very
//     action we ask them to take would silently erase what we gave them.
//
// Stored on the listing:
//   comp_tier            'premium' | 'featured'
//   comp_until           ISO — the grant ends at this instant
//   comp_source          promotion id, for reporting
//   comp_granted_at      ISO
//   comp_reminder_sent_at ISO | null — the "your free period ends soon" email
//
// While a comp is active the listing's `tier` is set to the comp tier, so every
// existing read path (detail page, directory ranking, owner dashboard) behaves
// exactly as for a paying listing. The cron puts `tier` back when it ends.

export type CompTier = 'premium' | 'featured'

export type CompListing = {
  tier?: unknown
  comp_tier?: unknown
  comp_until?: unknown
  comp_reminder_sent_at?: unknown
  stripe_subscription_id?: unknown
}

export const WARM_LEADS_PROMO = {
  id: 'warm_leads_3mo_premium_2026_09',
  tier: 'premium' as CompTier,
  months: 3,
  // The reminder goes out this many days before the grant ends.
  reminderDaysBefore: 15,
} as const

const DAY_MS = 86_400_000

function compTierOf(listing: CompListing): CompTier | null {
  return listing.comp_tier === 'premium' || listing.comp_tier === 'featured' ? listing.comp_tier : null
}

function untilMs(listing: CompListing): number | null {
  if (typeof listing.comp_until !== 'string' || !listing.comp_until) return null
  const t = Date.parse(listing.comp_until)
  return Number.isFinite(t) ? t : null
}

function hasSubscription(listing: CompListing): boolean {
  return typeof listing.stripe_subscription_id === 'string' && listing.stripe_subscription_id !== ''
}

/** Same calendar day `months` later (clamped to the month's last day). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

/** The tier a live comp grants right now, or null. A grant with an unreadable
 *  end date is treated as NOT active: an open-ended free tier is the expensive
 *  failure, and the cron reports it rather than honouring it. */
export function activeCompTier(listing: CompListing, now: Date = new Date()): CompTier | null {
  const tier = compTierOf(listing)
  const until = untilMs(listing)
  if (!tier || until === null) return null
  return until > now.getTime() ? tier : null
}

/** A comp was granted and its period is over (or its end date is unreadable). */
export function compEnded(listing: CompListing, now: Date = new Date()): boolean {
  return compTierOf(listing) !== null && activeCompTier(listing, now) === null
}

export function compGrantPatch(
  now: Date,
  promo: { id: string; tier: CompTier; months: number } = WARM_LEADS_PROMO
): Record<string, unknown> {
  return {
    tier: promo.tier,
    comp_tier: promo.tier,
    comp_until: addMonths(now, promo.months).toISOString(),
    comp_source: promo.id,
    comp_granted_at: now.toISOString(),
    comp_reminder_sent_at: null,
    updated_at: now.toISOString(),
  }
}

/**
 * What to write when a comp ends. A listing that started PAYING during the
 * free period keeps its tier — the subscription governs it now, and the webhook
 * owns every tier change from there. Otherwise it returns to Basic, the same
 * place a cancelled subscription lands.
 */
export function compExpiryPatch(listing: CompListing, now: Date): Record<string, unknown> {
  const cleared = {
    comp_tier: null,
    comp_until: null,
    comp_expired_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
  if (hasSubscription(listing)) return cleared
  // Only lower the tier the comp itself raised; never touch a tier something
  // else set (e.g. an admin moved it to Featured by hand).
  return listing.tier === compTierOf(listing) ? { ...cleared, tier: 'basic' } : cleared
}

/** Send the "ends soon" email once, inside the final `daysBefore` days, and
 *  never to a listing that is already paying. */
export function needsCompReminder(
  listing: CompListing,
  now: Date = new Date(),
  daysBefore: number = WARM_LEADS_PROMO.reminderDaysBefore
): boolean {
  if (!activeCompTier(listing, now) || hasSubscription(listing)) return false
  if (listing.comp_reminder_sent_at) return false
  const until = untilMs(listing)!
  return until - now.getTime() <= daysBefore * DAY_MS
}
