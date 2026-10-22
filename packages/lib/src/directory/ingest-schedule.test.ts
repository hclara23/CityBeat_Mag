import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INGEST_FETCH_BUDGET_MS,
  OVERPASS_ATTEMPT_MS,
  OVERPASS_BACKOFF_MS,
  OVERPASS_MAX_ATTEMPTS,
  canStartCategory,
  fullSweepRuns,
  guaranteedCategoriesPerRun,
  ingestRunIndex,
  summarizeSweep,
  sweepOffsetForRun,
  sweepOrder,
  worstCaseCategoryMs,
} from './ingest-schedule'

// The failure these pin: citybeat-directory-ingest reported DEADLINE_EXCEEDED on
// every attempt for a week and produced zero new inventory, because the sweep
// could take 1,932 seconds inside a 300-second request and wrote nothing at all
// when it overran.

test('the worst case for one category fits inside the fetch budget', () => {
  // The whole point. If this ever stops holding, the sweep can time out again,
  // and it will do so silently until someone reads a scheduler status code.
  assert.ok(
    worstCaseCategoryMs() <= INGEST_FETCH_BUDGET_MS,
    `one category can take ${worstCaseCategoryMs()}ms but the budget is ${INGEST_FETCH_BUDGET_MS}ms`
  )
})

test('the fetch budget leaves room to actually write the results', () => {
  // Cloud Run's request timeout on citybeat-web is 300s. The dedupe and the
  // batched Firestore writes happen AFTER the fetch loop, and they are the only
  // part that produces anything — a budget that consumed the full request would
  // reproduce the original bug exactly: work done, nothing saved.
  const cloudRunTimeoutMs = 300_000
  assert.ok(INGEST_FETCH_BUDGET_MS < cloudRunTimeoutMs, 'budget must be under the request timeout')
  assert.ok(
    cloudRunTimeoutMs - INGEST_FETCH_BUDGET_MS >= 45_000,
    'leave at least 45s to dedupe, write and respond'
  )
})

test('backoff is counted between attempts, not after the last one', () => {
  assert.equal(
    worstCaseCategoryMs(1000, 3, 100),
    3 * 1000 + 2 * 100,
    'three attempts have two pauses between them'
  )
  assert.equal(worstCaseCategoryMs(1000, 1, 100), 1000, 'a single attempt never waits')
})

test('a nonsensical attempt count still yields one real attempt', () => {
  assert.equal(worstCaseCategoryMs(1000, 0, 100), 1000)
  assert.equal(worstCaseCategoryMs(1000, -5, 100), 1000)
})

test('the client timeout is not longer than the server has agreed to wait', () => {
  // Overpass is asked for [timeout:40]. A 90s client timeout — what shipped —
  // waits 50 extra seconds on a request the server already abandoned, and that
  // waste is what consumed the budget.
  assert.ok(OVERPASS_ATTEMPT_MS >= 40_000, 'must allow the server its full 40s')
  assert.ok(OVERPASS_ATTEMPT_MS <= 60_000, 'must not wait far past the server giving up')
  assert.equal(OVERPASS_MAX_ATTEMPTS, 2)
  assert.ok(OVERPASS_BACKOFF_MS > 0, 'Overpass rate-limits; always pause before retrying')
})

// --- Rotation: the reason the tail is not starved -----------------------------

test('each run starts at a different category', () => {
  const q = ['a', 'b', 'c', 'd']
  assert.deepEqual(sweepOrder(q, 0), ['a', 'b', 'c', 'd'])
  assert.deepEqual(sweepOrder(q, 1), ['b', 'c', 'd', 'a'])
  assert.deepEqual(sweepOrder(q, 3), ['d', 'a', 'b', 'c'])
  assert.deepEqual(sweepOrder(q, 4), ['a', 'b', 'c', 'd'], 'wraps')
})

test('rotation survives a negative or absurd run index instead of returning nothing', () => {
  const q = ['a', 'b', 'c']
  assert.deepEqual(sweepOrder(q, -1), ['c', 'a', 'b'])
  assert.deepEqual(sweepOrder(q, -4), ['c', 'a', 'b'])
  assert.equal(sweepOrder(q, 1e9).length, 3)
  assert.deepEqual(sweepOrder([], 5), [])
})

test('rotation preserves every category — it reorders, never drops', () => {
  const q = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  for (let run = 0; run < 20; run++) {
    assert.deepEqual([...sweepOrder(q, run)].sort(), [...q].sort(), `run ${run} lost or duplicated a category`)
  }
})

test('every category is reached within a full sweep cycle', () => {
  // The guarantee that replaces "one run does everything": across
  // fullSweepRuns() consecutive nights, taking only the guaranteed number of
  // categories each night, nothing is left unvisited. A fixed order would visit
  // the same head forever and never touch the rest.
  const q = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const perRun = guaranteedCategoriesPerRun()
  const runs = fullSweepRuns(q.length)
  const seen = new Set<string>()
  for (let run = 0; run < runs; run++) {
    for (const category of sweepOrder(q, sweepOffsetForRun(run, perRun)).slice(0, perRun)) seen.add(category)
  }
  assert.equal(seen.size, q.length, `only ${seen.size}/${q.length} categories swept in ${runs} runs`)
})

test('the start offset advances by what a run consumes, not by one', () => {
  // Advancing by one while consuming two overlaps every window and strands the
  // tail of the list forever.
  assert.equal(sweepOffsetForRun(0, 2), 0)
  assert.equal(sweepOffsetForRun(1, 2), 2)
  assert.equal(sweepOffsetForRun(3, 2), 6)
  assert.equal(sweepOffsetForRun(2, 0), 2, 'a zero stride would never advance')
})

test('the sweep cycle is short enough to be useful', () => {
  // Insert-only inventory of businesses that do not appear overnight, so a
  // multi-night cycle is acceptable — but if this ever creeps past a week the
  // trade has stopped being reasonable and needs revisiting.
  assert.ok(fullSweepRuns(7) <= 7, `a full sweep now takes ${fullSweepRuns(7)} nights`)
})

test('a category count of zero asks for no runs rather than dividing by zero', () => {
  assert.equal(fullSweepRuns(0), 0)
  assert.equal(fullSweepRuns(-3), 0)
})

// --- The budget gate ------------------------------------------------------------

test('the first category always runs, however tight the budget', () => {
  // A run that attempts nothing and reports success is the same silent nothing
  // this change exists to end — strictly worse than overrunning by one, because
  // it looks healthy.
  assert.equal(canStartCategory(0, 0, 1, 999_999), true)
  assert.equal(canStartCategory(5_000_000, 0, 1_000, 999_999), true)
})

test('a later category only starts when it can actually finish', () => {
  const categoryMs = 90_000
  const budget = 240_000
  assert.equal(canStartCategory(0, 1, budget, categoryMs), true, '240s left, needs 90s')
  assert.equal(canStartCategory(100_000, 1, budget, categoryMs), true, '140s left, needs 90s')
  assert.equal(canStartCategory(160_000, 2, budget, categoryMs), false, '80s left, needs 90s')
  assert.equal(canStartCategory(240_000, 3, budget, categoryMs), false, 'budget exhausted')
  assert.equal(canStartCategory(999_999, 3, budget, categoryMs), false, 'overrun')
})

test('a negative elapsed time cannot be used to claim extra budget', () => {
  assert.equal(canStartCategory(-100_000, 1, 100_000, 90_000), true)
  assert.equal(canStartCategory(-100_000, 1, 50_000, 90_000), false, 'still cannot fit 90s into 50s')
})

test('the real configuration permits more than one category per run', () => {
  // If the tuning ever made the sweep one-category-per-night, a full cycle would
  // take over a week and the rotation guarantee above would quietly weaken.
  assert.ok(
    guaranteedCategoriesPerRun() >= 2,
    `only ${guaranteedCategoriesPerRun()} category guaranteed per run`
  )
})

// --- Run index ------------------------------------------------------------------

test('the run index advances once per day and is stable within a day', () => {
  const morning = new Date('2026-10-21T02:00:00Z')
  const evening = new Date('2026-10-21T23:00:00Z')
  const nextDay = new Date('2026-10-22T02:00:00Z')
  assert.equal(ingestRunIndex(morning), ingestRunIndex(evening), 'one index per calendar day (UTC)')
  assert.equal(ingestRunIndex(nextDay), ingestRunIndex(morning) + 1)
})

test('an unusable clock falls back to a valid index rather than NaN', () => {
  // A NaN offset would make sweepOrder return a rotation of NaN % length and
  // silently sweep nothing.
  assert.equal(ingestRunIndex(new Date('nonsense')), 0)
  assert.equal(sweepOrder(['a', 'b'], ingestRunIndex(new Date('nonsense'))).length, 2)
})

// --- Per-query outcomes collapsed to per-category reporting --------------------

test('a category with two selectors is reported once, not twice', () => {
  // Real Estate is both office=estate_agent and shop=estate_agent. The raw
  // per-query lists named it twice, which read as a bug in the response.
  const summary = summarizeSweep({
    swept: ['Real Estate', 'Real Estate', 'Marketing'],
    skipped: [],
    failed: [],
  })
  assert.deepEqual(summary.swept, ['Real Estate', 'Marketing'])
})

test('a category cannot be both swept and deferred in the same run', () => {
  // One selector ran, the other was cut by the budget. The reader's question is
  // "did we get anything for Real Estate?" — yes. Listing it as deferred too
  // would send someone looking for a problem that is not there.
  const summary = summarizeSweep({
    swept: ['Real Estate'],
    skipped: ['Real Estate', 'Attorneys'],
    failed: [],
  })
  assert.deepEqual(summary.swept, ['Real Estate'])
  assert.deepEqual(summary.skipped, ['Attorneys'])
})

test('a category that partially succeeded is not reported as failed', () => {
  const summary = summarizeSweep({
    swept: ['Real Estate'],
    failed: [{ category: 'Real Estate', reason: 'Overpass returned 504' }],
    skipped: [],
  })
  assert.deepEqual(summary.failed, [], 'something was ingested, so it is not a failure to chase')
})

test('a category that failed every selector is still reported as failed, once', () => {
  const summary = summarizeSweep({
    swept: [],
    skipped: [],
    failed: [
      { category: 'Real Estate', reason: 'timeout' },
      { category: 'Real Estate', reason: 'Overpass returned 429' },
    ],
  })
  assert.equal(summary.failed.length, 1)
  assert.equal(summary.failed[0].category, 'Real Estate')
  assert.equal(summary.failed[0].reason, 'timeout', 'keeps the first reason seen')
})

test('an empty sweep summarizes to empty lists rather than throwing', () => {
  assert.deepEqual(summarizeSweep({ swept: [], skipped: [], failed: [] }), {
    swept: [],
    skipped: [],
    failed: [],
  })
})
