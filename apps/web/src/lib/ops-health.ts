// Pure rules for the two questions nothing in this system could previously
// answer: "is the unattended machine still RUNNING?" and "is it still EARNING?"
//
// WHY THIS EXISTS. Every alert in the codebase was exception-driven —
// reportFailure is only ever reached from a catch block — so the two failures
// that actually end this business were both completely invisible:
//
//   1. A cron that STOPS RUNNING throws nothing. reportSuccess() used to return
//      early on a healthy run and write nothing at all, so no record existed
//      anywhere of when any job last executed, and the Cloud Scheduler jobs are
//      not in this repo for anything to assert against. Rotate CRON_SECRET on
//      Cloud Run and forget the scheduler jobs, or pause one, and every cron
//      401s before its try/catch: citybeat-payout-cycle silently stops paying
//      reps, citybeat-reconcile-orders silently stops catching dropped Stripe
//      payments, and the Monday ops digest still prints "Automation failures:
//      0 — all healthy" because it derived health from rows a job that never
//      runs never creates.
//
//   2. Revenue STOPPING throws nothing either — nobody completing checkout
//      means no code runs. An archived price id, a Stripe-disabled webhook
//      destination or a pricing page that hides the buy button leaves
//      /api/health green, every cron reporting success, and the first signal is
//      a number in Friday's email up to seven days later.
//
// No Firestore and no Next imports here on purpose: these are decisions, and
// decisions get unit tests (ops-health.test.ts).

const HOUR_MS = 3600_000

export type CronExpectation = {
  /** system_health doc id — must match the string the job passes to reportSuccess(). */
  source: string
  label: string
  /** Overdue past this and the job is considered dead. Roughly 2x cadence plus slack:
   *  a single missed run is a retry, a doubled interval is a stopped job. */
  maxAgeHours: number
  /**
   * Don't judge this source until it has reported at least once. For agents we
   * do NOT deploy in lockstep with the web app (the Cloudflare worker ships via
   * `cd services/worker && npm run deploy`), a missing record means "not
   * deployed yet", not "dead" — and a false alarm on every deploy is how an
   * alerting channel gets muted by the person reading it.
   */
  armOnFirstRun?: boolean
}

/**
 * The Cloud Scheduler jobs, mirrored. This table is the ONLY thing in the repo
 * that asserts the 19 jobs still exist; there is no infra-as-code for them.
 *
 * Sources deliberately absent:
 *   • `cron:reconcile-payouts` — /api/cron/reconcile-payouts never calls
 *     reportSuccess(), so it can never stamp a run and would alert forever.
 *     Listing it here without that call would be an invariant this code cannot
 *     enforce. Add the call in that route, then add the row.
 *   • `stripe-webhook` / `payout-transfer` — event-driven, not scheduled. A
 *     quiet hour is not a failure; their silence is what the revenue rules below
 *     are for.
 */
export const CRON_EXPECTATIONS: CronExpectation[] = [
  // Daily jobs (schedules per CLAUDE.md, America/Chihuahua).
  { source: 'cron:referrals', label: 'referral rewards', maxAgeHours: 36 },
  { source: 'cron:directory-ingest', label: 'directory ingest', maxAgeHours: 36 },
  { source: 'cron:enrich-contacts', label: 'contact enrichment', maxAgeHours: 36 },
  { source: 'cron:sync-events', label: 'event sync', maxAgeHours: 36 },
  { source: 'cron:translate-listings', label: 'listing translation (ES)', maxAgeHours: 36 },
  { source: 'cron:checkout-recovery', label: 'abandoned checkout recovery', maxAgeHours: 36 },
  { source: 'cron:sales-agent', label: 'sales agent', maxAgeHours: 36 },
  { source: 'cron:social', label: 'social posting', maxAgeHours: 36 },
  { source: 'cron:scrapeflow', label: 'scrapeflow scraper', maxAgeHours: 36 },
  { source: 'reconcile-orders', label: 'Stripe order reconciliation', maxAgeHours: 36 },
  { source: 'cron:heartbeat', label: 'ops heartbeat', maxAgeHours: 36 },
  { source: 'cron:claims-aging', label: 'paid claims awaiting approval', maxAgeHours: 36 },
  // Daily. Completes commission transfers that failed at webhook time, so its
  // silence withholds money a rep has already earned.
  { source: 'cron:reconcile-payouts', label: 'commission transfer reconciliation', maxAgeHours: 36 },
  // Four times a day.
  { source: 'cron:auto-articles', label: 'autonomous newsroom', maxAgeHours: 12 },
  // Weekly jobs — 9 days, so one skipped week is unmistakable but a late run isn't.
  { source: 'cron:ops-digest', label: 'weekly ops digest', maxAgeHours: 216 },
  { source: 'cron:newsletter-digest', label: 'newsletter digest', maxAgeHours: 216 },
  { source: 'cron:upsell', label: 'Premium→Featured upsell', maxAgeHours: 216 },
  { source: 'cron:account-manager', label: 'AI account manager', maxAgeHours: 216 },
  // Cadence is not declared anywhere in the repo for ghost-reports (it rate-limits
  // itself to one report per listing per quarter), so this is the loose bound that
  // still catches a permanently dead job without inventing a schedule.
  { source: 'cron:ghost-reports', label: 'ghost traffic reports', maxAgeHours: 216 },
  // 1st and 15th — 17 days covers the longest gap (15th → 1st) plus slack.
  // This is the one whose silence costs a rep their commission.
  { source: 'cron:payout-cycle', label: 'commission payout cycle', maxAgeHours: 408 },
  // Monthly on the 1st.
  { source: 'cron:owner-reports', label: 'owner ROI reports', maxAgeHours: 840 },
  // Cloudflare worker, 5x/day. Reports in over HTTP, so it arms itself.
  { source: 'worker:brief-automation', label: 'worker brief ingestion', maxAgeHours: 12, armOnFirstRun: true },
]

export type StaleCron = {
  source: string
  label: string
  maxAgeHours: number
  /** Hours since the last recorded run, or null when it has NEVER reported one. */
  ageHours: number | null
}

export type LivenessInput = {
  nowMs: number
  /** Last recorded run per source, epoch ms. Missing/null = never recorded. */
  lastRunAtMs: Record<string, number | null | undefined>
  /**
   * When liveness recording itself started. A source with no record is only
   * called dead once tracking has been in place longer than that source's own
   * max age — otherwise the first deploy of this feature would fire twenty
   * alerts at once for jobs that are perfectly healthy and simply haven't run
   * yet under the new code.
   */
  trackingSinceMs: number | null
  expectations?: CronExpectation[]
}

export type LivenessReport = {
  stale: StaleCron[]
  onTime: string[]
  /** Not judgeable yet: inside the bootstrap grace, or waiting to arm. */
  waiting: string[]
  checked: number
}

/** Decide which scheduled jobs have stopped running. */
export function evaluateCronLiveness(input: LivenessInput): LivenessReport {
  const expectations = input.expectations ?? CRON_EXPECTATIONS
  const stale: StaleCron[] = []
  const onTime: string[] = []
  const waiting: string[] = []

  for (const expectation of expectations) {
    const maxAgeMs = expectation.maxAgeHours * HOUR_MS
    const last = input.lastRunAtMs[expectation.source]

    if (typeof last === 'number' && Number.isFinite(last) && last > 0) {
      const ageMs = input.nowMs - last
      if (ageMs > maxAgeMs) {
        stale.push({ ...toStale(expectation), ageHours: ageMs / HOUR_MS })
      } else {
        onTime.push(expectation.source)
      }
      continue
    }

    // Never reported. Only a failure once we've been watching long enough to
    // know the silence is real.
    const trackedForMs = input.trackingSinceMs === null ? 0 : input.nowMs - input.trackingSinceMs
    if (expectation.armOnFirstRun || trackedForMs <= maxAgeMs) {
      waiting.push(expectation.source)
      continue
    }
    stale.push({ ...toStale(expectation), ageHours: null })
  }

  // Worst first: never-ran, then most overdue relative to its own budget. An
  // alert email truncates, so the ordering decides what the operator reads.
  stale.sort((a, b) => overdueRank(b) - overdueRank(a))
  return { stale, onTime, waiting, checked: expectations.length }
}

function toStale(expectation: CronExpectation): Omit<StaleCron, 'ageHours'> {
  return { source: expectation.source, label: expectation.label, maxAgeHours: expectation.maxAgeHours }
}

function overdueRank(row: StaleCron): number {
  return row.ageHours === null ? Number.MAX_SAFE_INTEGER : row.ageHours / row.maxAgeHours
}

/** One-line, email-safe summary of a stale job. */
export function describeStaleCron(row: StaleCron): string {
  return row.ageHours === null
    ? `${row.label} (${row.source}) — never ran`
    : `${row.label} (${row.source}) — last ran ${Math.floor(row.ageHours)}h ago, expected every ${row.maxAgeHours}h`
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

/** Silence longer than this, from a business that normally sells, is a stop. */
export const REVENUE_STALL_HOURS = 72
/**
 * Below this many paid rows in the baseline window there IS no normal cadence
 * to deviate from, so no alert is possible without inventing one. This is the
 * false-positive guard: a genuinely quiet month must never page anyone, because
 * an alert channel that cries wolf is one the operator stops reading — and this
 * one goes to a single personal mailbox.
 */
export const REVENUE_BASELINE_MIN_SALES = 8
export const REVENUE_BASELINE_DAYS = 30
/** Week-over-week collapse: this week under 30% of last week. */
export const REVENUE_COLLAPSE_RATIO = 0.3
/** …and only when last week was big enough for the ratio to mean anything. */
export const REVENUE_COLLAPSE_FLOOR_CENTS = 20_000

export type RevenueSignal = {
  /** Paid rows in the trailing REVENUE_BASELINE_DAYS. */
  baselineCount: number
  /** Ms since the most recent paid row; null when there has never been one. */
  msSinceLastPaid: number | null
  /** Collected cents, last 7 days. */
  currentWindowCents: number
  /** Collected cents, the 7 days before that. */
  priorWindowCents: number
}

export type RevenueVerdict = {
  /** `quiet` = no baseline to judge against; deliberately NOT an alert. */
  status: 'ok' | 'quiet' | 'collapsed' | 'stalled'
  alert: boolean
  reason: string
}

/**
 * Decide whether money has stopped arriving.
 *
 * Two independent detectors, because they catch different outages:
 *   • stalled — nothing at all has been paid for REVENUE_STALL_HOURS. This is
 *     the archived price id / disabled webhook destination / broken buy button,
 *     and it fires within three days instead of within a week.
 *   • collapsed — money still arrives but week-over-week has fallen off a
 *     cliff. This is the partial break: one product's checkout 500ing, or the
 *     ES half of a bilingual flow going dead.
 */
export function evaluateRevenueHealth(
  signal: RevenueSignal,
  opts: { stallHours?: number; minBaseline?: number } = {}
): RevenueVerdict {
  const stallHours = opts.stallHours ?? REVENUE_STALL_HOURS
  const minBaseline = opts.minBaseline ?? REVENUE_BASELINE_MIN_SALES

  if (signal.baselineCount < minBaseline) {
    return {
      status: 'quiet',
      alert: false,
      reason: `only ${signal.baselineCount} paid rows in ${REVENUE_BASELINE_DAYS}d — no baseline to call a stop against`,
    }
  }

  // Unreachable while baselineCount is above the floor, but the floor is
  // configurable, so this stays a real branch rather than an assumption.
  if (signal.msSinceLastPaid === null) {
    return { status: 'stalled', alert: true, reason: 'no payment has ever been recorded' }
  }

  const hoursSince = signal.msSinceLastPaid / HOUR_MS
  if (hoursSince > stallHours) {
    return {
      status: 'stalled',
      alert: true,
      reason: `no payment in ${Math.floor(hoursSince)}h (${signal.baselineCount} paid rows in the prior ${REVENUE_BASELINE_DAYS}d — this business normally sells)`,
    }
  }

  if (
    signal.priorWindowCents >= REVENUE_COLLAPSE_FLOOR_CENTS &&
    signal.currentWindowCents < signal.priorWindowCents * REVENUE_COLLAPSE_RATIO
  ) {
    return {
      status: 'collapsed',
      alert: true,
      reason: `revenue fell to $${(signal.currentWindowCents / 100).toFixed(2)} this week from $${(signal.priorWindowCents / 100).toFixed(2)} last week`,
    }
  }

  return {
    status: 'ok',
    alert: false,
    reason: `$${(signal.currentWindowCents / 100).toFixed(2)} collected in 7d, last payment ${Math.floor(hoursSince)}h ago`,
  }
}

// ---------------------------------------------------------------------------
// Alert recipients
// ---------------------------------------------------------------------------

export const DEFAULT_ALERT_EMAIL = 'morningstarelp@gmail.com'
/** An env typo like a pasted paragraph must not fan a page out to a hundred addresses. */
const MAX_ALERT_RECIPIENTS = 10

/**
 * Parse ALERT_EMAIL into a recipient LIST.
 *
 * lib/email.ts sendEmail() takes exactly one address, and every alert in the
 * system went to one hardcoded personal mailbox — no second responder, and no
 * way to add one without a code change. Accepting a separated list here means
 * adding a co-responder is an env-var edit on the Cloud Run service, which the
 * operator can do from a phone.
 *
 * Invalid entries are dropped rather than failing the parse: a typo in one
 * address must never silence the alert to the others.
 */
export function parseAlertRecipients(
  raw: string | null | undefined,
  fallback: string = DEFAULT_ALERT_EMAIL
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of String(raw ?? '').split(/[,;\s]+/)) {
    const address = part.trim()
    // Deliberately loose: this is a sanity filter, not RFC validation. The mail
    // provider is the authority on deliverability.
    if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) continue
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(address)
    if (out.length >= MAX_ALERT_RECIPIENTS) break
  }
  return out.length ? out : [fallback]
}
