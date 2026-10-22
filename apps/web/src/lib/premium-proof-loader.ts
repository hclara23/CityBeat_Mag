import { daysAgoKey } from './listing-analytics'
import { countActions, isPaidProofListing, pickRepresentativeProof, type ProofCandidate, type ProofListing } from './premium-proof'

export const PROOF_SCAN_LIMIT = 100
export const PROOF_SAMPLE_LIMIT = 12
export const PROOF_WINDOW_DAYS = 30
export type ProofStat = { listingId: string; counts: Partial<Omit<ProofCandidate, 'listingId'>> }
export type ProofReader = {
  listings: (limit: number) => Promise<ProofListing[]>
  stats: (ids: string[], days: string[]) => Promise<ProofStat[]>
}

// Separate read failures (reject) from a successful but thin sample (null proof).
// Diagnostics contain counts only, never customer or subscription identifiers.
export async function loadPremiumProof(reader: ProofReader, now = new Date()) {
  const scanned = await reader.listings(PROOF_SCAN_LIMIT)
  const eligible = scanned.filter(isPaidProofListing)
  const sampled = eligible.slice(0, PROOF_SAMPLE_LIMIT)
  const totals = new Map<string, ProofCandidate>(sampled.map(({ listingId }) => [listingId, {
    listingId, view: 0, click_website: 0, click_directions: 0,
    click_phone: 0, click_action: 0, lead: 0,
  }]))
  const days = Array.from({ length: PROOF_WINDOW_DAYS }, (_, i) => daysAgoKey(now, i))
  const stats = sampled.length ? await reader.stats(sampled.map(x => x.listingId), days) : []
  const withStats = new Set<string>()
  for (const row of stats) {
    const total = totals.get(row.listingId)
    if (!total) continue
    withStats.add(row.listingId)
    for (const key of ['view', 'click_website', 'click_directions', 'click_phone', 'click_action', 'lead'] as const) {
      const value = Number(row.counts[key])
      if (Number.isFinite(value) && value > 0) total[key] += value
    }
  }
  const candidates = [...totals.values()]
  const proof = pickRepresentativeProof(candidates, PROOF_WINDOW_DAYS)
  return {
    proof,
    diagnostics: {
      status: proof ? 'ready' : sampled.length ? 'insufficient_activity' : 'no_eligible_listings',
      scanned: scanned.length, scanLimitReached: scanned.length === PROOF_SCAN_LIMIT,
      eligible: eligible.length, sampled: sampled.length, listingsWithStats: withStats.size,
      statsDays: stats.length, windowDays: PROOF_WINDOW_DAYS,
      views: candidates.reduce((sum, x) => sum + x.view, 0),
      actions: candidates.reduce((sum, x) => sum + countActions(x), 0),
    },
  }
}
