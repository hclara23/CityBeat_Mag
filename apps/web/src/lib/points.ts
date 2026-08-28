// Contributor points & levels. Pure (no I/O) so the rules, thresholds, and
// leaderboard ranking are unit-tested and shared by the award sites, the
// /account reviewer dashboard, and the public leaderboard.
//
// Points were previously a bare `review_points` integer awarded +10 per review
// with the level ladder inlined in the account page. This centralizes the rules
// and adds the events the public asked for (photo contributions), while a
// `points_ledger` collection (written by callers) gives an idempotent, audited
// trail instead of a get-then-set that could double-award.

export type PointEvent =
  | 'review'
  | 'review_photo'
  | 'business_photo' // a public photo contributed to a business, once approved
  | 'event_submission'

export const POINT_VALUES: Record<PointEvent, number> = {
  review: 10,
  review_photo: 5,
  business_photo: 5,
  event_submission: 3,
}

export function pointsFor(event: PointEvent): number {
  return POINT_VALUES[event] ?? 0
}

export type ContributorLevel = {
  level: number
  name: string
  badge: string
  floor: number
  next: number | null // points needed for the next level, or null at max
}

// Ordered ascending. Kept in sync with the historical /account ladder so no
// contributor is demoted by this refactor.
const LEVELS: Array<{ level: number; name: string; badge: string; floor: number }> = [
  { level: 1, name: 'Bronze', badge: '🥉', floor: 0 },
  { level: 2, name: 'Silver', badge: '🥈', floor: 50 },
  { level: 3, name: 'Gold', badge: '🥇', floor: 100 },
  { level: 4, name: 'Elite', badge: '👑', floor: 200 },
]

export function levelForPoints(points: number): ContributorLevel {
  const p = Math.max(0, Math.floor(Number(points) || 0))
  let current = LEVELS[0]
  for (const l of LEVELS) if (p >= l.floor) current = l
  const idx = LEVELS.findIndex((l) => l.level === current.level)
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1].floor : null
  return { ...current, next }
}

/** Progress 0–100 toward the next level (100 at max level). */
export function levelProgress(points: number): number {
  const p = Math.max(0, Math.floor(Number(points) || 0))
  const lvl = levelForPoints(p)
  if (lvl.next === null) return 100
  const span = lvl.next - lvl.floor
  if (span <= 0) return 100
  return Math.min(100, Math.max(0, Math.round(((p - lvl.floor) / span) * 100)))
}

export type LeaderboardRow = {
  user_id: string
  name: string
  points: number
  level: number
  badge: string
  rank: number
}

/**
 * Rank contributors for the public leaderboard. Excludes advertisers (they earn
 * no points and shouldn't appear as "top reviewers"), drops zero-point users,
 * and ranks by points desc with a stable name tiebreak. Standard competition
 * ranking (ties share a rank).
 */
export function buildLeaderboard(
  users: Array<{ user_id: string; name?: string; points?: number; is_advertiser?: boolean }>,
  limit = 50
): LeaderboardRow[] {
  const eligible = users
    .filter((u) => !u.is_advertiser && (Number(u.points) || 0) > 0)
    .map((u) => ({
      user_id: u.user_id,
      name: (u.name || 'Contributor').trim() || 'Contributor',
      points: Math.floor(Number(u.points) || 0),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))

  const rows: LeaderboardRow[] = []
  let lastPoints: number | null = null
  let lastRank = 0
  eligible.slice(0, limit).forEach((u, i) => {
    const rank = lastPoints !== null && u.points === lastPoints ? lastRank : i + 1
    lastPoints = u.points
    lastRank = rank
    const lvl = levelForPoints(u.points)
    rows.push({ ...u, level: lvl.level, badge: lvl.badge, rank })
  })
  return rows
}
