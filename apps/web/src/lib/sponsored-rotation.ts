// The directory's gold "Sponsored Listings" grid is the most prominent
// placement on the site (top of the whole /directory page) — capped to 3
// visible cards per view. Any number of listings can hold is_sponsored at
// once (it's not a scarce sitewide slot, just a display cap); once more than
// 3 qualify, which 3 show — and in what order — is picked at random on every
// view, so no single sponsor permanently occupies a slot.

export const SPONSORED_SLOTS = 3

export interface SponsoredCandidate {
  id: string
}

/** Fisher–Yates shuffle. `random` is injectable so callers/tests can supply a seeded PRNG. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Pick up to `slots` sponsors from the full pool, in random order. With
 * `slots` or fewer candidates, everyone shows (still shuffled, so position
 * varies). With more, a random `slots`-sized subset shows each time this is
 * called — call it once per page view/render, not per candidate.
 */
export function selectSponsoredWindow<T extends SponsoredCandidate>(
  candidates: T[],
  slots: number = SPONSORED_SLOTS,
  random: () => number = Math.random
): T[] {
  return shuffle(candidates, random).slice(0, slots)
}

/** Is `sponsored_until` (if set) already in the past? Absent/null means "no expiry". */
export function sponsorshipExpired(sponsoredUntil: unknown, now: Date = new Date()): boolean {
  if (typeof sponsoredUntil !== 'string' || !sponsoredUntil) return false
  const t = Date.parse(sponsoredUntil)
  return Number.isFinite(t) && t <= now.getTime()
}
