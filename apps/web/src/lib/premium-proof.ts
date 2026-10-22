// Real numbers for the /premium results panel, instead of invented ones.
//
// WHY. The panel showed "14 customer actions in 30 days" broken into 6 website
// clicks, 4 directions, 3 actions and 1 lead. Those figures were made up. They
// carried an "Illustrative example; actual results vary" label, which is the
// honest thing to do with invented numbers — but the page's entire argument is
// "Premium gives you transparent measurement, you will see your real numbers".
// Illustrating that claim with fiction undercuts the one thing the page is
// selling, and a prospect who later compares the panel to their own dashboard
// learns that CityBeat's marketing numbers mean nothing.
//
// So the panel reads actual listing_stats now. Three rules make that safe to
// publish:
//
//   1. ANONYMOUS. Only aggregate counts cross this boundary — never a listing
//      id, business name, or anything that identifies whose numbers these are.
//      A paying customer did not agree to have their performance advertised.
//   2. TYPICAL, NOT BEST. The representative is the MEDIAN of the candidates by
//      total actions, never the maximum. Cherry-picking the best month is the
//      same dishonesty as inventing a number, just harder to catch.
//   3. SILENT WHEN THIN. Below a floor of real activity it returns null and the
//      page hides the panel. The honest answer to "we have no compelling data
//      yet" is to show nothing, not to reach for a plausible-looking figure.
//
// Pure here, Firestore in premium-proof-server.ts, so the selection rules are
// unit-tested (premium-proof.test.ts) rather than trusted.

export type ProofCandidate = {
  /** Used only for selection and never returned. */
  listingId: string
  view: number
  click_website: number
  click_directions: number
  click_phone: number
  click_action: number
  lead: number
}

/** What the page renders. Deliberately carries no identifier of any kind. */
export type PremiumProof = {
  windowDays: number
  /** The headline: customer actions, excluding passive views. */
  actions: number
  views: number
  website: number
  directions: number
  calls: number
  leads: number
  /** How many listings the median was taken across, for the page's own footnote. */
  sampleSize: number
}

/**
 * Customer ACTIONS, not page views.
 *
 * A view is someone looking; an action is someone doing something that costs the
 * business nothing and might earn it money. Counting views in the headline would
 * inflate it with the cheapest possible number — and views are exactly what a
 * sceptical owner discounts, because every directory quotes impressions.
 */
export function countActions(candidate: ProofCandidate): number {
  return (
    Math.max(0, candidate.click_website) +
    Math.max(0, candidate.click_directions) +
    Math.max(0, candidate.click_phone) +
    Math.max(0, candidate.click_action) +
    Math.max(0, candidate.lead)
  )
}

/**
 * The floor below which no panel is better than a weak panel.
 *
 * Five actions in a month is not an argument for paying 19.99, and publishing it
 * would invite exactly the objection the page exists to answer. If the real data
 * cannot carry the claim, the page should not make the claim.
 */
export const MIN_ACTIONS_TO_PUBLISH = 6

/** The lower-median index: with an even count, prefer the LOWER of the two
 *  middle values, so the published figure is never flattered by rounding. */
export function medianIndex(count: number): number {
  if (count <= 0) return -1
  return Math.floor((count - 1) / 2)
}

/**
 * Choose the listing whose month the page will describe.
 *
 * Returns null when nothing clears the floor, which the page must treat as
 * "render no panel" rather than "render zeros".
 */
export function pickRepresentativeProof(
  candidates: readonly ProofCandidate[],
  windowDays = 30
): PremiumProof | null {
  const qualifying = candidates
    .filter((candidate) => countActions(candidate) >= MIN_ACTIONS_TO_PUBLISH)
    // Ascending, with the listing id as a tie-break so the same input always
    // yields the same published figure rather than drifting with Firestore's
    // document order.
    .sort((a, b) => countActions(a) - countActions(b) || a.listingId.localeCompare(b.listingId))

  const index = medianIndex(qualifying.length)
  if (index < 0) return null

  const chosen = qualifying[index]
  return {
    windowDays,
    actions: countActions(chosen),
    views: Math.max(0, chosen.view),
    website: Math.max(0, chosen.click_website),
    directions: Math.max(0, chosen.click_directions),
    calls: Math.max(0, chosen.click_phone),
    leads: Math.max(0, chosen.lead),
    sampleSize: qualifying.length,
  }
}

/**
 * The four tiles the panel shows, largest first, with empty ones dropped.
 *
 * A tile reading "0 leads" on a page arguing that Premium produces leads is an
 * argument against buying. Showing only what actually happened is both more
 * honest and more persuasive.
 */
export function proofTiles(proof: PremiumProof): Array<{ key: string; value: number }> {
  return [
    { key: 'website', value: proof.website },
    { key: 'directions', value: proof.directions },
    { key: 'calls', value: proof.calls },
    { key: 'leads', value: proof.leads },
  ]
    .filter((tile) => tile.value > 0)
    .sort((a, b) => b.value - a.value)
}
