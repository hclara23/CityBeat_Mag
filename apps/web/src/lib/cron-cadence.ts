// How often a cron expression ACTUALLY fires, so the heartbeat's budget can be
// checked against it instead of guessed.
//
// WHY THIS EXISTS. Three places describe each scheduled job's cadence and none
// of them could see the others:
//
//   1. Cloud Scheduler — the only one that is true.
//   2. infra/scheduler/jobs.json — a drift check, but it was CAPTURED from live,
//      so a job created with the wrong schedule is recorded as the intent and
//      reports "no drift" forever after.
//   3. CRON_EXPECTATIONS in ops-health.ts — a hand-written maxAgeHours per job,
//      whose own comment for one entry read "cadence is not declared anywhere in
//      the repo", which was simply not true once (2) existed.
//
// citybeat-ghost-reports is what this cost: its schedule is `0 10 5 * *` —
// 10:00 on the FIFTH OF EACH MONTH — while CLAUDE.md documented it as daily at
// 16:00 and the heartbeat allowed it 216 hours. Nine days after every run the
// heartbeat would have begun paging "ghost traffic reports has stopped running"
// every six hours for the remaining three weeks of the month, forever, about a
// job that was working exactly as scheduled. An alert channel that cries wolf
// for three weeks out of four is an alert channel nobody reads — which is the
// specific failure the heartbeat was built to prevent.
//
// So: derive the real maximum gap from the cron expression, and make a budget
// that cannot possibly hold a fact the schedule contradicts.
//
// Pure on purpose — no Firestore, no clock, no Next. Decisions get unit tests
// (cron-cadence.test.ts), and that test reads the real manifest and the real
// expectation table, so the two can never drift apart again in silence.

export type CronCadence = {
  /** Fires observed in the sample window. 0 means the expression never fires. */
  fires: number
  /** Longest wall-clock gap between consecutive fires, in hours. */
  maxGapHours: number
  /** Shortest gap between consecutive fires, in hours. */
  minGapHours: number
}

/**
 * Parse one cron field into the set of values it permits.
 * Supports `*`, `a`, `a,b`, `a-b`, `* /n` and `a-b/n` — the whole grammar Cloud
 * Scheduler accepts for these jobs. Anything else throws rather than being
 * quietly treated as `*`, because a silently-permissive parser would report a
 * far-too-frequent cadence and hide exactly the bug this file exists to catch.
 */
/** Strict integer parse. `Number('')` is 0, which would silently turn the
 *  malformed field "-3" into the range 0-3 — a real cron would reject it, and so
 *  must this, or a typo'd schedule reads as a valid, more frequent one. */
function int(raw: string): number {
  if (!/^\d+$/.test(raw ?? '')) return NaN
  return Number(raw)
}

export function parseCronField(field: string, min: number, max: number): number[] {
  const out = new Set<number>()

  for (const part of field.split(',')) {
    const piece = part.trim()
    if (!piece) throw new Error(`empty cron field element in "${field}"`)

    const [range, stepRaw, ...extra] = piece.split('/')
    if (extra.length) throw new Error(`more than one step in "${piece}"`)
    const step = stepRaw === undefined ? 1 : int(stepRaw)
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad step "${stepRaw}" in "${field}"`)

    let lo: number
    let hi: number
    if (range === '*') {
      lo = min
      hi = max
    } else if (range.includes('-')) {
      const [a, b, ...rest] = range.split('-')
      if (rest.length) throw new Error(`bad range "${range}" in "${field}"`)
      lo = int(a)
      hi = int(b)
    } else {
      lo = int(range)
      // A bare value with a step means "from here to the end", as cron does.
      hi = stepRaw === undefined ? lo : max
    }

    if (!Number.isInteger(lo) || !Number.isInteger(hi)) throw new Error(`bad range "${range}" in "${field}"`)
    if (lo < min || hi > max || lo > hi) throw new Error(`range "${range}" out of bounds ${min}-${max}`)

    for (let v = lo; v <= hi; v += step) out.add(v)
  }

  return [...out].sort((a, b) => a - b)
}

/** The window the cadence is sampled over: long enough to contain a leap
 *  February, every month length, and two year boundaries — so a monthly job's
 *  true worst gap (31 days) and the 15th→1st payout gap are both observed. */
const SAMPLE_START_UTC = Date.UTC(2027, 0, 1)
const SAMPLE_DAYS = 1200
const DAY_MS = 86_400_000

/**
 * Measure a 5-field cron expression: `minute hour day-of-month month day-of-week`.
 *
 * Gaps are wall-clock, ignoring any DST shift in the job's timezone. That is
 * deliberate: an hour of error is irrelevant to "is this budget sane?", and
 * America/Chihuahua has not observed DST since 2022 anyway. Modelling it would
 * add a timezone database dependency to a pure decision function for nothing.
 */
export function cronCadence(expression: string): CronCadence {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error(`expected 5 cron fields, got ${fields.length} in "${expression}"`)

  const [minF, hourF, domF, monF, dowF] = fields
  const minutes = parseCronField(minF, 0, 59)
  const hours = parseCronField(hourF, 0, 23)
  const doms = new Set(parseCronField(domF, 1, 31))
  const months = new Set(parseCronField(monF, 1, 12))
  // Cron allows both 0 and 7 for Sunday.
  const dows = new Set(parseCronField(dowF, 0, 7).map((d) => (d === 7 ? 0 : d)))

  const domRestricted = domF.trim() !== '*'
  const dowRestricted = dowF.trim() !== '*'

  const fireTimes: number[] = []

  for (let d = 0; d < SAMPLE_DAYS; d++) {
    const dayMs = SAMPLE_START_UTC + d * DAY_MS
    const day = new Date(dayMs)
    const month = day.getUTCMonth() + 1
    if (!months.has(month)) continue

    const dom = day.getUTCDate()
    const dow = day.getUTCDay()

    // Vixie-cron semantics, which Cloud Scheduler follows: when BOTH
    // day-of-month and day-of-week are restricted the day matches if EITHER
    // does. Treating it as AND would under-count fires and overstate the gap.
    const dayMatches =
      domRestricted && dowRestricted
        ? doms.has(dom) || dows.has(dow)
        : (!domRestricted || doms.has(dom)) && (!dowRestricted || dows.has(dow))

    if (!dayMatches) continue

    for (const h of hours) {
      for (const m of minutes) {
        fireTimes.push(dayMs + h * 3600_000 + m * 60_000)
      }
    }
  }

  if (fireTimes.length < 2) {
    return { fires: fireTimes.length, maxGapHours: Infinity, minGapHours: Infinity }
  }

  let maxGap = 0
  let minGap = Infinity
  for (let i = 1; i < fireTimes.length; i++) {
    const gap = fireTimes[i] - fireTimes[i - 1]
    if (gap > maxGap) maxGap = gap
    if (gap < minGap) minGap = gap
  }

  return {
    fires: fireTimes.length,
    maxGapHours: maxGap / 3600_000,
    minGapHours: minGap / 3600_000,
  }
}

export type CadenceVerdict = 'ok' | 'tight' | 'too_tight' | 'too_loose' | 'never_fires'

export type CadenceCheck = {
  verdict: CadenceVerdict
  maxGapHours: number
  slackHours: number
  /** Plain-English consequence, safe to print in a check script. */
  detail: string
}

/** A Cloud Scheduler retry can push a run late by up to about this long, so a
 *  budget with less slack than this is one hiccup away from a false alarm. */
const RETRY_SLACK_HOURS = 6

/** A dead job should not stay invisible for more than roughly four cycles. */
function looseCeiling(maxGapHours: number): number {
  return maxGapHours * 4 + 48
}

/**
 * Is this job's staleness budget consistent with the schedule it actually runs on?
 *
 * `too_tight` is the only verdict that means "this WILL fire a false alarm" —
 * the budget is shorter than the job's normal gap between runs, so the alert is
 * guaranteed, every cycle, about a perfectly healthy job. That is an error.
 * `tight` and `too_loose` are judgement calls worth reporting, not failing.
 */
export function checkCadence(cronExpression: string, maxAgeHours: number): CadenceCheck {
  const { fires, maxGapHours } = cronCadence(cronExpression)

  if (fires === 0 || !Number.isFinite(maxGapHours)) {
    return {
      verdict: 'never_fires',
      maxGapHours: Infinity,
      slackHours: -Infinity,
      detail: `"${cronExpression}" fires at most once in three years — almost certainly not the intended schedule.`,
    }
  }

  const slackHours = maxAgeHours - maxGapHours

  if (slackHours < 0) {
    return {
      verdict: 'too_tight',
      maxGapHours,
      slackHours,
      detail:
        `runs at most every ${fmt(maxGapHours)}, but is declared stale after ${fmt(maxAgeHours)}. ` +
        `The heartbeat will page about this job for ${fmt(-slackHours)} of every cycle while it is working correctly.`,
    }
  }

  if (slackHours < RETRY_SLACK_HOURS) {
    return {
      verdict: 'tight',
      maxGapHours,
      slackHours,
      detail:
        `runs at most every ${fmt(maxGapHours)} with only ${fmt(slackHours)} of slack — ` +
        `a single retried or delayed run pages someone.`,
    }
  }

  if (maxAgeHours > looseCeiling(maxGapHours)) {
    return {
      verdict: 'too_loose',
      maxGapHours,
      slackHours,
      detail:
        `runs every ${fmt(maxGapHours)} but is not called dead for ${fmt(maxAgeHours)} — ` +
        `it could stop for four cycles before anyone hears about it.`,
    }
  }

  return {
    verdict: 'ok',
    maxGapHours,
    slackHours,
    detail: `runs at most every ${fmt(maxGapHours)}, stale after ${fmt(maxAgeHours)} (${fmt(slackHours)} slack).`,
  }
}

function fmt(hours: number): string {
  if (!Number.isFinite(hours)) return 'never'
  if (Math.abs(hours) < 48) return `${round(hours)}h`
  return `${round(hours / 24)}d`
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

/** `https://…/api/cron/ghost-reports?limit=25` → `ghost-reports`. Returns null
 *  for a target that is not a cron route, so non-cron jobs are skipped rather
 *  than mis-attributed. */
export function cronRouteFromUri(uri: string): string | null {
  const match = /\/api\/cron\/([A-Za-z0-9_-]+)/.exec(uri || '')
  return match ? match[1] : null
}
