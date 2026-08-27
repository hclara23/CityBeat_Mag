// The directory's gold "Sponsored Listings" grid is a hard-capped, most-
// prominent placement (top of the whole page, not just a category) — so with
// more than SPONSORED_SLOTS paying sponsors it must rotate fairly rather than
// let whoever bought first (or has the highest rating) permanently occupy
// every slot. Deterministic per-day windowing: no cron, no stored rotation
// state, same 3 shown all day (no mid-session flicker), advances daily, and
// every sponsor gets equal exposure over a full cycle.

export const SPONSORED_SLOTS = 3
const DAY_MS = 24 * 60 * 60 * 1000

export interface SponsoredCandidate {
  id: string
  sponsored_since?: string | null
  created_at?: string | null
}

/** Stable order so the rotation windows are consistent from one call to the next. */
function stableOrder<T extends SponsoredCandidate>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const at = Date.parse(a.sponsored_since || a.created_at || '') || 0
    const bt = Date.parse(b.sponsored_since || b.created_at || '') || 0
    if (at !== bt) return at - bt
    return a.id.localeCompare(b.id)
  })
}

/**
 * Pick today's window of at most `slots` sponsors from the full pool.
 * - <= slots candidates: everyone shows, every day (no rotation needed).
 * - > slots candidates: advances to the next group of `slots` once per day,
 *   wrapping around; the final group wraps into the front of the list so a
 *   day never renders a partial (1- or 2-card) row.
 */
export function selectSponsoredWindow<T extends SponsoredCandidate>(
  candidates: T[],
  now: Date = new Date(),
  slots: number = SPONSORED_SLOTS
): T[] {
  const ordered = stableOrder(candidates)
  if (ordered.length <= slots) return ordered

  const dayIndex = Math.floor(now.getTime() / DAY_MS)
  const groups = Math.ceil(ordered.length / slots)
  const start = (dayIndex % groups) * slots
  const window: T[] = []
  for (let i = 0; i < slots; i++) window.push(ordered[(start + i) % ordered.length])
  return window
}

/** Is `sponsored_until` (if set) already in the past? Absent/null means "no expiry". */
export function sponsorshipExpired(sponsoredUntil: unknown, now: Date = new Date()): boolean {
  if (typeof sponsoredUntil !== 'string' || !sponsoredUntil) return false
  const t = Date.parse(sponsoredUntil)
  return Number.isFinite(t) && t <= now.getTime()
}
