import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import {
  CRON_EXPECTATIONS,
  DEFAULT_ALERT_EMAIL,
  REVENUE_BASELINE_MIN_SALES,
  REVENUE_STALL_HOURS,
  describeStaleCron,
  evaluateCronLiveness,
  evaluateRevenueHealth,
  parseAlertRecipients,
  type CronExpectation,
} from './ops-health'

const HOUR = 3600_000
const NOW = Date.parse('2026-09-05T12:00:00.000Z')

const daily: CronExpectation[] = [{ source: 'cron:daily', label: 'daily job', maxAgeHours: 36 }]

test('a job that ran within its budget is on time, and one past it is stale', () => {
  const fresh = evaluateCronLiveness({
    nowMs: NOW,
    lastRunAtMs: { 'cron:daily': NOW - 10 * HOUR },
    trackingSinceMs: NOW - 400 * HOUR,
    expectations: daily,
  })
  assert.deepEqual(fresh.stale, [])
  assert.deepEqual(fresh.onTime, ['cron:daily'])

  const dead = evaluateCronLiveness({
    nowMs: NOW,
    lastRunAtMs: { 'cron:daily': NOW - 50 * HOUR },
    trackingSinceMs: NOW - 400 * HOUR,
    expectations: daily,
  })
  assert.equal(dead.stale.length, 1)
  assert.equal(dead.stale[0].source, 'cron:daily')
  assert.equal(Math.round(dead.stale[0].ageHours!), 50)
})

test('a job that has NEVER reported is only called dead once we have watched it long enough', () => {
  // Pins the regression that would have made this feature unusable: on the
  // first deploy every cron has no last_run_at, and alerting on all of them at
  // once is how an operator learns to ignore the channel.
  const bootstrapping = evaluateCronLiveness({
    nowMs: NOW,
    lastRunAtMs: {},
    trackingSinceMs: NOW - 2 * HOUR,
    expectations: daily,
  })
  assert.deepEqual(bootstrapping.stale, [])
  assert.deepEqual(bootstrapping.waiting, ['cron:daily'])

  const reallyNeverRan = evaluateCronLiveness({
    nowMs: NOW,
    lastRunAtMs: {},
    trackingSinceMs: NOW - 100 * HOUR,
    expectations: daily,
  })
  assert.equal(reallyNeverRan.stale.length, 1)
  assert.equal(reallyNeverRan.stale[0].ageHours, null)
  assert.match(describeStaleCron(reallyNeverRan.stale[0]), /never ran/)
})

test('tracking that has never started at all judges nothing', () => {
  // trackingSinceMs === null means the registry doc is missing, i.e. we have no
  // idea how long we have been watching. Alerting from that state would be a
  // guess, and this alert wakes a human.
  const report = evaluateCronLiveness({
    nowMs: NOW,
    lastRunAtMs: {},
    trackingSinceMs: null,
    expectations: daily,
  })
  assert.deepEqual(report.stale, [])
  assert.deepEqual(report.waiting, ['cron:daily'])
})

test('a source marked armOnFirstRun never alerts until it has reported once', () => {
  // The Cloudflare worker deploys separately from the web app, so "no record"
  // means "the new worker is not deployed yet", not "the worker is dead".
  const worker: CronExpectation[] = [
    { source: 'worker:x', label: 'worker', maxAgeHours: 12, armOnFirstRun: true },
  ]
  const unarmed = evaluateCronLiveness({
    nowMs: NOW,
    lastRunAtMs: {},
    trackingSinceMs: NOW - 5000 * HOUR,
    expectations: worker,
  })
  assert.deepEqual(unarmed.stale, [])
  assert.deepEqual(unarmed.waiting, ['worker:x'])

  // Once it HAS reported, silence is judged like any other job.
  const armedAndDead = evaluateCronLiveness({
    nowMs: NOW,
    lastRunAtMs: { 'worker:x': NOW - 40 * HOUR },
    trackingSinceMs: NOW - 5000 * HOUR,
    expectations: worker,
  })
  assert.equal(armedAndDead.stale.length, 1)
})

test('stale jobs are ordered worst-first so a truncated alert still shows the worst', () => {
  const report = evaluateCronLiveness({
    nowMs: NOW,
    lastRunAtMs: { 'cron:a': NOW - 40 * HOUR, 'cron:b': NOW - 400 * HOUR },
    trackingSinceMs: NOW - 5000 * HOUR,
    expectations: [
      { source: 'cron:a', label: 'a', maxAgeHours: 36 },
      { source: 'cron:b', label: 'b', maxAgeHours: 36 },
      { source: 'cron:never', label: 'never', maxAgeHours: 36 },
    ],
  })
  assert.deepEqual(
    report.stale.map((s) => s.source),
    ['cron:never', 'cron:b', 'cron:a']
  )
})

test('every expected source is one a route actually stamps', () => {
  // The trap this pins: listing a job that never calls reportSuccess() means it
  // is reported stale forever, and a permanently-red alert is the same as no
  // alert. The original version of this test hardcoded the one job that could not
  // stamp (cron:reconcile-payouts) — which then had to be edited the moment that
  // job was fixed, i.e. it tested a snapshot rather than the rule.
  //
  // This reads the actual routes instead, so neither adding an expectation for a
  // job that cannot stamp NOR making a job stamp without registering it can pass
  // unnoticed.
  const cronDir = fileURLToPath(new URL('../app/api/cron', import.meta.url))
  const stamped = new Set<string>()
  for (const entry of readdirSync(cronDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let body = ''
    try {
      body = readFileSync(join(cronDir, entry.name, 'route.ts'), 'utf8')
    } catch {
      continue
    }
    for (const m of body.matchAll(/reportSuccess\(\s*'([^']+)'/g)) stamped.add(m[1])
  }
  // The Cloudflare worker reports in over HTTP rather than from a cron route.
  stamped.add('worker:brief-automation')

  const sources = CRON_EXPECTATIONS.map((e) => e.source)
  assert.equal(new Set(sources).size, sources.length, 'duplicate source in CRON_EXPECTATIONS')

  for (const source of sources) {
    assert.ok(
      stamped.has(source),
      `CRON_EXPECTATIONS lists "${source}" but no cron route calls reportSuccess('${source}') — it would be reported stale forever`
    )
  }

  // The ones whose silence costs real money must stay covered.
  for (const must of ['cron:payout-cycle', 'reconcile-orders', 'cron:reconcile-payouts', 'cron:heartbeat']) {
    assert.ok(sources.includes(must), `${must} must be liveness-monitored`)
  }
  // stripe-webhook is event-driven, not scheduled — it has no cadence to be late against.
  assert.ok(!sources.includes('stripe-webhook'))

  for (const e of CRON_EXPECTATIONS) assert.ok(e.maxAgeHours > 0, `${e.source} needs a budget`)
})

const busy = { baselineCount: 40, msSinceLastPaid: 2 * HOUR, currentWindowCents: 50_000, priorWindowCents: 60_000 }

test('a business that is selling normally raises nothing', () => {
  const verdict = evaluateRevenueHealth(busy)
  assert.equal(verdict.status, 'ok')
  assert.equal(verdict.alert, false)
})

test('payments stopping for three days on a business that normally sells is an alert', () => {
  const verdict = evaluateRevenueHealth({ ...busy, msSinceLastPaid: (REVENUE_STALL_HOURS + 1) * HOUR })
  assert.equal(verdict.status, 'stalled')
  assert.equal(verdict.alert, true)
  assert.match(verdict.reason, /no payment in 73h/)
})

test('a quiet business is never paged — no baseline means no alert', () => {
  // The false-positive guard. This alert lands in one personal mailbox; a
  // seasonal lull that pages the operator is how that mailbox stops being read.
  const verdict = evaluateRevenueHealth({
    baselineCount: REVENUE_BASELINE_MIN_SALES - 1,
    msSinceLastPaid: 30 * 24 * HOUR,
    currentWindowCents: 0,
    priorWindowCents: 0,
  })
  assert.equal(verdict.status, 'quiet')
  assert.equal(verdict.alert, false)
})

test('a week-over-week collapse alerts even while some money still arrives', () => {
  // The partial break: one product's checkout 500ing still leaves recent
  // payments, so the stall detector stays silent and this one has to fire.
  const verdict = evaluateRevenueHealth({
    baselineCount: 40,
    msSinceLastPaid: 6 * HOUR,
    currentWindowCents: 5_000,
    priorWindowCents: 80_000,
  })
  assert.equal(verdict.status, 'collapsed')
  assert.equal(verdict.alert, true)
})

test('a collapse from a trivial prior week is noise, not a signal', () => {
  // $50 -> $10 is a 80% "collapse" and means nothing. Below the floor, ratios
  // are not evidence.
  const verdict = evaluateRevenueHealth({
    baselineCount: 40,
    msSinceLastPaid: 6 * HOUR,
    currentWindowCents: 1_000,
    priorWindowCents: 5_000,
  })
  assert.equal(verdict.status, 'ok')
  assert.equal(verdict.alert, false)
})

test('alert recipients parse into a de-duplicated list and always resolve to someone', () => {
  assert.deepEqual(parseAlertRecipients('a@x.com, b@y.com'), ['a@x.com', 'b@y.com'])
  assert.deepEqual(parseAlertRecipients(' a@x.com ; A@X.com \n b@y.com'), ['a@x.com', 'b@y.com'])
  // A typo in one address must not silence the alert to the others.
  assert.deepEqual(parseAlertRecipients('not-an-email, b@y.com'), ['b@y.com'])
  // Never returns an empty list: an unset/garbage env var must not mean
  // "alerting is off", which is the silent failure this whole file exists for.
  assert.deepEqual(parseAlertRecipients(''), [DEFAULT_ALERT_EMAIL])
  assert.deepEqual(parseAlertRecipients(undefined), [DEFAULT_ALERT_EMAIL])
  assert.deepEqual(parseAlertRecipients('garbage'), [DEFAULT_ALERT_EMAIL])
  // A pasted paragraph must not fan a page out to a hundred addresses.
  const many = Array.from({ length: 40 }, (_, i) => `a${i}@x.com`).join(',')
  assert.equal(parseAlertRecipients(many).length, 10)
})
