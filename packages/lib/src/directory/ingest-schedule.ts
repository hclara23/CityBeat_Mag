// How much of the directory sweep can actually be done inside one request.
//
// WHY THIS EXISTS. `citybeat-directory-ingest` failed every attempt for a week
// (DEADLINE_EXCEEDED, 2026-10-15 onward, all four retries from 10-19) and the
// arithmetic says it could never have been reliable: seven categories, fetched
// sequentially, each allowed three attempts at a 90-second client timeout with
// backoff. Worst case 7 x (3 x 90s + 6s) = 1,932 seconds, against a Cloud Run
// request timeout of 300. It only ever passed when Overpass happened to be fast.
//
// The expensive part was not the timeout itself. `writeCandidates` runs AFTER
// the whole fetch loop, so a run that overran wrote NOTHING — six categories
// could succeed and the night's work was still discarded. That is why a week of
// failures produced zero new inventory rather than a reduced amount.
//
// So the sweep is now budgeted: it starts a category only while there is enough
// wall clock left to finish one, then writes what it has and reports what it
// deferred. A partial sweep is a successful sweep.
//
// Two consequences worth stating, because they are deliberate:
//
//   1. One run no longer covers every category. Coverage comes from ROTATION —
//      each run starts at a different offset, so the tail is not permanently
//      starved the way a fixed order plus a budget would starve it. (The same
//      shape of bug as the payout reconciliation reading the same head rows
//      every night.) A full sweep takes a few nights, which is fine: this is
//      insert-only inventory of businesses that do not appear overnight.
//
//   2. Overpass stays sequential. It is a donated community service whose usage
//      policy asks for low parallelism, and the module it feeds already notes
//      that it rate-limits aggressive callers. Being ingest-banned would cost
//      far more than a slower sweep. Concurrency is the wrong lever here.
//
// Pure and clock-injected so the decisions are unit-tested (ingest-schedule.test.ts)
// rather than discovered in production a second time.

/** Overpass is asked for `[out:json][timeout:40]`, so the server gives up at 40s.
 *  A 90-second client timeout could only ever wait on a connection the server had
 *  already abandoned — it bought nothing and cost the whole budget. */
export const OVERPASS_ATTEMPT_MS = 45_000

/** Two tries, not three. A third attempt costs a whole category's budget to
 *  retry a service that has already failed twice inside 90 seconds. */
export const OVERPASS_MAX_ATTEMPTS = 2

/** Overpass rate-limits aggressive callers; pause before trying again. */
export const OVERPASS_BACKOFF_MS = 2_000

/**
 * The fetch budget for one request. Cloud Run's request timeout on
 * `citybeat-web` is 300s (confirmed, not assumed), and the route declares
 * maxDuration 300 to match. 240 leaves 60 seconds for dedupe, the batched
 * Firestore writes and the response — the part that must not be cut off,
 * because it is the only part that produces anything of value.
 */
export const INGEST_FETCH_BUDGET_MS = 240_000

/** The longest one category can take before the sweep gives up on it. */
export function worstCaseCategoryMs(
  attemptMs: number = OVERPASS_ATTEMPT_MS,
  maxAttempts: number = OVERPASS_MAX_ATTEMPTS,
  backoffMs: number = OVERPASS_BACKOFF_MS
): number {
  const attempts = Math.max(1, Math.floor(maxAttempts))
  // Backoff happens BETWEEN attempts, so there is one fewer pause than attempt.
  return attempts * attemptMs + (attempts - 1) * backoffMs
}

/**
 * Which run this is. Day-based so consecutive nightly runs rotate, and derived
 * from the clock rather than stored, so there is no cursor document to go stale,
 * get wiped, or need a migration. A missed night simply skips an offset.
 */
export function ingestRunIndex(now: Date = new Date()): number {
  const ms = now.getTime()
  if (!Number.isFinite(ms)) return 0
  return Math.floor(ms / 86_400_000)
}

/**
 * The order to attempt categories in for this run.
 *
 * Rotating the start offset is what keeps the budget from starving the tail: with
 * a fixed order, the categories that fit are always the same first two and the
 * last five are never ingested at all. The relative order within the rotation is
 * preserved so the behaviour stays predictable when reading logs.
 */
export function sweepOrder<T>(queries: readonly T[], runIndex: number): T[] {
  if (queries.length === 0) return []
  const offset = ((Math.floor(runIndex) % queries.length) + queries.length) % queries.length
  return [...queries.slice(offset), ...queries.slice(0, offset)]
}

/**
 * May the sweep begin another category?
 *
 * ALWAYS true for the first one. A budget so tight that nothing is attempted
 * would produce a run that does no work and reports success — which is exactly
 * the silent-nothing failure this change exists to end. Better to overrun by one
 * category and have the route's own timeout catch it than to invent a green run
 * that ingested nothing.
 */
export function canStartCategory(
  elapsedMs: number,
  completedCount: number,
  budgetMs: number = INGEST_FETCH_BUDGET_MS,
  categoryMs: number = worstCaseCategoryMs()
): boolean {
  if (completedCount === 0) return true
  const remaining = budgetMs - Math.max(0, elapsedMs)
  return remaining >= categoryMs
}

/**
 * How many categories a budget can be relied on to cover, for the runbook and
 * for the sweep-coverage test. Deliberately the GUARANTEED figure, not the
 * optimistic one: if Overpass is responsive the real run covers far more,
 * because a fast category consumes a fraction of its worst case.
 */
export function guaranteedCategoriesPerRun(
  budgetMs: number = INGEST_FETCH_BUDGET_MS,
  categoryMs: number = worstCaseCategoryMs()
): number {
  return Math.max(1, Math.floor(budgetMs / categoryMs))
}

/**
 * Where run `runIndex` should start in the category list.
 *
 * The offset advances by how many categories a run actually CONSUMES, not by
 * one. Advancing by one while consuming two re-sweeps an overlapping window
 * every night and never reaches the end of the list: with seven categories and
 * two per night, offsets 0,1,2,3 cover only five of them. The coverage test
 * pins this, because it is exactly the mistake the rotation existed to avoid.
 */
export function sweepOffsetForRun(
  runIndex: number,
  perRun: number = guaranteedCategoriesPerRun()
): number {
  return Math.floor(runIndex) * Math.max(1, Math.floor(perRun))
}

/**
 * Collapse per-QUERY outcomes into per-CATEGORY reporting.
 *
 * The budget is spent per query, but some categories carry more than one OSM
 * selector — "Real Estate" is both `office=estate_agent` and
 * `shop=estate_agent`, two genuinely different sets of businesses. That made
 * the raw lists report the same category twice and, worse, let it appear in
 * `swept` and `skipped` at once when one selector ran and the other was
 * deferred.
 *
 * A reader of this response wants one question answered: did this run get
 * anything for that category? So a category that was reached at all counts as
 * swept, and only a category with nothing reached is reported as deferred or
 * failed.
 */
export function summarizeSweep(outcome: {
  swept: readonly string[]
  skipped: readonly string[]
  failed: readonly { category: string; reason: string }[]
}): {
  swept: string[]
  skipped: string[]
  failed: { category: string; reason: string }[]
} {
  const swept = [...new Set(outcome.swept)]
  const reached = new Set(swept)
  return {
    swept,
    skipped: [...new Set(outcome.skipped)].filter((category) => !reached.has(category)),
    failed: outcome.failed.filter(
      (entry, index, all) =>
        !reached.has(entry.category) &&
        all.findIndex((other) => other.category === entry.category) === index
    ),
  }
}

/** Nights needed to be certain every category has been swept at least once. */
export function fullSweepRuns(
  categoryCount: number,
  budgetMs: number = INGEST_FETCH_BUDGET_MS,
  categoryMs: number = worstCaseCategoryMs()
): number {
  if (categoryCount <= 0) return 0
  return Math.ceil(categoryCount / guaranteedCategoriesPerRun(budgetMs, categoryMs))
}
