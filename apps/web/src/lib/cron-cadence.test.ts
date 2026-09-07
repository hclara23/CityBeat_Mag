import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cronCadence, parseCronField, checkCadence, cronRouteFromUri } from './cron-cadence'
import { CRON_EXPECTATIONS } from './ops-health'

// ---------------------------------------------------------------------------
// The parser. A permissive parser is worse than none here: silently reading an
// unknown field as `*` reports a far-too-frequent cadence, which makes every
// budget look generous and hides the exact bug this module exists to catch.
// ---------------------------------------------------------------------------

test('a star covers the whole range', () => {
  assert.deepEqual(parseCronField('*', 0, 6), [0, 1, 2, 3, 4, 5, 6])
})

test('lists, ranges and steps parse the way cron means them', () => {
  assert.deepEqual(parseCronField('6,11,15,19', 0, 23), [6, 11, 15, 19])
  assert.deepEqual(parseCronField('1-5', 0, 23), [1, 2, 3, 4, 5])
  assert.deepEqual(parseCronField('*/6', 0, 23), [0, 6, 12, 18])
  assert.deepEqual(parseCronField('0-12/4', 0, 23), [0, 4, 8, 12])
  // A bare value with a step runs from that value to the end of the range.
  assert.deepEqual(parseCronField('20/2', 0, 23), [20, 22])
  // Overlapping list elements collapse rather than double-counting fires.
  assert.deepEqual(parseCronField('1,1,2', 0, 23), [1, 2])
})

test('nonsense throws instead of quietly meaning "always"', () => {
  for (const bad of ['', 'x', '5-2', '1-99', '*/0', '*/x', '-3', '1,,2']) {
    assert.throws(() => parseCronField(bad, 0, 23), `"${bad}" must not parse`)
  }
})

// ---------------------------------------------------------------------------
// The measurement.
// ---------------------------------------------------------------------------

test('a daily job has a 24-hour gap', () => {
  const c = cronCadence('0 8 * * *')
  assert.equal(c.maxGapHours, 24)
  assert.equal(c.minGapHours, 24)
})

test('a job four times a day is measured by its LONGEST gap, not its average', () => {
  // 06:30, 11:30, 15:30, 19:30 — the overnight stretch is 11 hours, and that is
  // the number a staleness budget has to clear. An "average 6h" reading would
  // make an 8-hour budget look fine when it would page every single night.
  const c = cronCadence('30 6,11,15,19 * * *')
  assert.equal(c.maxGapHours, 11)
  assert.equal(c.minGapHours, 4)
})

test('a weekly job has a 7-day gap', () => {
  assert.equal(cronCadence('0 8 * * 1').maxGapHours, 168)
})

test('a monthly job has a 31-day worst gap, not 30', () => {
  // The longest month sets the budget; using 30 days would page for a day every
  // time the job follows a 31-day month.
  assert.equal(cronCadence('0 9 1 * *').maxGapHours, 31 * 24)
})

test('twice-monthly on the 1st and 15th peaks at 17 days', () => {
  // Dec 15 -> Jan 1 is the widest stretch in the payout calendar.
  assert.equal(cronCadence('0 9 1,15 * *').maxGapHours, 17 * 24)
})

test('day-of-month and day-of-week together mean OR, as cron does', () => {
  // `0 0 1 * 1` fires on the 1st AND on every Monday. Reading it as AND would
  // report a wildly overstated gap and mark a healthy budget too tight.
  const c = cronCadence('0 0 1 * 1')
  assert.ok(c.maxGapHours <= 7 * 24, `expected weekly-or-better, got ${c.maxGapHours}h`)
})

test('sunday is 0 or 7 and means the same day either way', () => {
  assert.equal(cronCadence('0 0 * * 0').maxGapHours, cronCadence('0 0 * * 7').maxGapHours)
})

test('an expression that can never fire is reported, not silently averaged', () => {
  const c = cronCadence('0 0 30 2 *') // February 30th
  assert.equal(c.fires, 0)
  assert.equal(c.maxGapHours, Infinity)
  assert.equal(checkCadence('0 0 30 2 *', 24).verdict, 'never_fires')
})

test('a malformed expression throws rather than returning a plausible number', () => {
  assert.throws(() => cronCadence('0 8 * *'))
  assert.throws(() => cronCadence('0 8 * * * *'))
})

// ---------------------------------------------------------------------------
// The verdict.
// ---------------------------------------------------------------------------

test('a budget shorter than the real gap is too_tight — a guaranteed false alarm', () => {
  // This is the citybeat-ghost-reports shape exactly: monthly job, 9-day budget.
  const c = checkCadence('0 10 5 * *', 216)
  assert.equal(c.verdict, 'too_tight')
  assert.ok(c.slackHours < 0)
  assert.match(c.detail, /page/)
})

test('a daily job with a 36-hour budget is fine', () => {
  assert.equal(checkCadence('0 3 * * *', 36).verdict, 'ok')
})

test('zero slack is tight, not ok — one retry pages someone', () => {
  assert.equal(checkCadence('0 9 1,15 * *', 17 * 24).verdict, 'tight')
})

test('a budget four cycles wide is too_loose', () => {
  // Daily job you would not call dead for a fortnight.
  assert.equal(checkCadence('0 3 * * *', 24 * 14).verdict, 'too_loose')
})

test('the route name is recovered from the job target, and only from a cron target', () => {
  assert.equal(cronRouteFromUri('https://x.a.run.app/api/cron/ghost-reports?limit=25'), 'ghost-reports')
  assert.equal(cronRouteFromUri('https://x.a.run.app/api/cron/payout-cycle'), 'payout-cycle')
  assert.equal(cronRouteFromUri('https://x.a.run.app/api/health'), null)
  assert.equal(cronRouteFromUri(''), null)
})

// ---------------------------------------------------------------------------
// The cross-check. This is the point of the file: the scheduler manifest and the
// heartbeat's expectation table are two independent descriptions of the same 21
// jobs, written at different times by different hands, and until now nothing
// compared them. It reads both real files, so it fails when they disagree.
// ---------------------------------------------------------------------------

function readManifestJobs(): Array<{ name: string; schedule: string; uri: string }> {
  const path = fileURLToPath(new URL('../../../../infra/scheduler/jobs.json', import.meta.url))
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const jobs = Array.isArray(parsed) ? parsed : parsed.jobs
  assert.ok(Array.isArray(jobs) && jobs.length > 0, 'scheduler manifest has no jobs')
  return jobs
}

/** route directory name -> the source string that route stamps via reportSuccess. */
function sourcesByRoute(): Map<string, string[]> {
  const cronDir = fileURLToPath(new URL('../app/api/cron', import.meta.url))
  const byRoute = new Map<string, string[]>()
  for (const entry of readdirSync(cronDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let body = ''
    try {
      body = readFileSync(join(cronDir, entry.name, 'route.ts'), 'utf8')
    } catch {
      continue
    }
    const found = [...body.matchAll(/reportSuccess\(\s*'([^']+)'/g)].map((m) => m[1])
    if (found.length) byRoute.set(entry.name, found)
  }
  return byRoute
}

test('every scheduled job in the manifest has a schedule this parser understands', () => {
  // If a schedule stops parsing, the cross-check below would silently skip that
  // job — so an unparseable expression must fail loudly here instead.
  for (const job of readManifestJobs()) {
    assert.doesNotThrow(() => cronCadence(job.schedule), `${job.name}: cannot parse "${job.schedule}"`)
    assert.ok(cronCadence(job.schedule).fires > 0, `${job.name}: "${job.schedule}" never fires`)
  }
})

test('no heartbeat budget contradicts the schedule the job actually runs on', () => {
  // The failure this pins, in full: citybeat-ghost-reports was created as
  // `0 10 5 * *` — the fifth of each month — while CLAUDE.md described it as
  // daily and the heartbeat gave it 216 hours. Nothing could see the
  // contradiction, because the manifest was captured FROM the live job (so the
  // wrong schedule became the declared intent) and the expectation table was
  // written by hand from the documentation. Nine days after each run the
  // heartbeat would have paged every six hours for three weeks, about a healthy
  // job, until whoever reads those alerts stopped reading them.
  const byRoute = sourcesByRoute()
  const budgets = new Map(CRON_EXPECTATIONS.map((e) => [e.source, e.maxAgeHours]))

  const problems: string[] = []
  let compared = 0

  for (const job of readManifestJobs()) {
    const route = cronRouteFromUri(job.uri)
    if (!route) continue
    for (const source of byRoute.get(route) ?? []) {
      const maxAgeHours = budgets.get(source)
      if (maxAgeHours === undefined) continue // not liveness-monitored; ops-health.test.ts owns that rule
      compared++
      const check = checkCadence(job.schedule, maxAgeHours)
      if (check.verdict === 'too_tight' || check.verdict === 'never_fires') {
        problems.push(`${job.name} (${source}, "${job.schedule}"): ${check.detail}`)
      }
    }
  }

  assert.ok(compared >= 15, `expected to compare most jobs, only compared ${compared}`)
  assert.deepEqual(problems, [], `heartbeat budget contradicts the real schedule:\n  ${problems.join('\n  ')}`)
})

test('every liveness-monitored cron route is actually a scheduled job', () => {
  // The other direction: a budget for a route nothing schedules would be a
  // permanent red alert. (The Cloudflare worker reports over HTTP, not from a
  // Cloud Scheduler job, so it is excluded by name.)
  const scheduledRoutes = new Set(
    readManifestJobs()
      .map((j) => cronRouteFromUri(j.uri))
      .filter((r): r is string => Boolean(r))
  )
  const byRoute = sourcesByRoute()

  for (const expectation of CRON_EXPECTATIONS) {
    if (expectation.source.startsWith('worker:')) continue
    const owningRoutes = [...byRoute.entries()]
      .filter(([, sources]) => sources.includes(expectation.source))
      .map(([route]) => route)
    assert.ok(owningRoutes.length > 0, `${expectation.source}: no cron route stamps it`)
    assert.ok(
      owningRoutes.some((r) => scheduledRoutes.has(r)),
      `${expectation.source}: route(s) ${owningRoutes.join(', ')} are monitored but no scheduler job calls them — the heartbeat would page forever`
    )
  }
})
