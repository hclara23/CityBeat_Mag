import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DUE_TOLERANCE_MS, overdueRatio } from './engine'

// ---------------------------------------------------------------------------
// The nightly queue. Eight enabled workflows share three slots once a day, and
// two separate bugs conspired to starve the one source that matters most:
// comptroller-el-paso-new-permits, the only feed supplying genuinely new El Paso
// businesses each weekday (~17-29 sales-tax permits). TABC and FMCSA are fully
// loaded and now insert ~0 rows a night.
// ---------------------------------------------------------------------------

const NOW = Date.parse('2026-10-27T08:30:00.000Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

test('a daily workflow that missed a cycle outranks a weekly one that just came due', () => {
  // The real 2026-10-27 ordering. Sorting by last_run_at ascending put tsbde
  // (weekly, 7 days old) first and pushed the Comptroller feed to fourth, where
  // the three-slot limit cut it.
  const comptroller = { last_run_at: hoursAgo(48), interval_hours: 24 }
  const weeklyDentists = { last_run_at: hoursAgo(168), interval_hours: 168 }
  assert.ok(
    overdueRatio(comptroller, NOW) > overdueRatio(weeklyDentists, NOW),
    'a daily source a full cycle behind must beat a weekly source that is merely due'
  )
  // And the old key really did order them the other way round.
  assert.ok(weeklyDentists.last_run_at < comptroller.last_run_at)
})

test('a weekly workflow that slips far enough wins its slot back', () => {
  // Self-balancing: daily sources must not permanently lock out the weeklies.
  const dailyJustDue = { last_run_at: hoursAgo(24), interval_hours: 24 }
  const weeklyLate = { last_run_at: hoursAgo(220), interval_hours: 168 }
  assert.ok(overdueRatio(weeklyLate, NOW) > overdueRatio(dailyJustDue, NOW))
})

test('a workflow that has never run sorts ahead of everything', () => {
  assert.equal(overdueRatio({ last_run_at: null, interval_hours: 24 }, NOW), Infinity)
  assert.equal(overdueRatio({ interval_hours: 24 }, NOW), Infinity)
  // An unparseable stamp must not read as "ran just now" and hide the workflow.
  assert.equal(overdueRatio({ last_run_at: 'not a date', interval_hours: 24 }, NOW), Infinity)
})

test('the due tolerance is wide enough that a cron’s own jitter cannot cost a day', () => {
  // The measured miss: started 2026-10-25T08:31:13, next tick 2026-10-26T08:30:00
  // — 86,327s elapsed against the 86,340s a 60-second tolerance demanded. Thirteen
  // seconds short, so it was filtered as not-due for a full day.
  const elapsedMs = Date.parse('2026-10-26T08:30:00Z') - Date.parse('2026-10-25T08:31:13Z')
  assert.equal(elapsedMs, 86_327_000)
  assert.ok(elapsedMs < 24 * 3_600_000 - 60_000, 'the old 60s tolerance rejected this run')
  assert.ok(elapsedMs >= 24 * 3_600_000 - DUE_TOLERANCE_MS, 'the tolerance must now accept it')
})
