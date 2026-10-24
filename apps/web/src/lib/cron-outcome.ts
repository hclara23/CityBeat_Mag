// Did the cron RUN, and separately, did its WORK succeed?
//
// WHY THIS EXISTS. citybeat-scrapeflow paged "1 scheduled job(s) have stopped
// running: scrapeflow scraper — last ran 39h ago" while the job had in fact run
// two hours earlier and processed workflows normally. One of several workflows
// inside it had failed, and the route did this:
//
//     if (failed.length) { await reportFailure(...) }
//     else               { await reportSuccess(...) }
//
// so a single failing workflow suppressed the liveness stamp entirely. The
// system_health doc then read `status: failing`, `last_run_at` two days stale,
// and the heartbeat correctly concluded the job was dead — about a job that was
// running fine. An operator chasing "why did the scraper stop" finds a perfectly
// healthy scheduler and nothing to fix.
//
// Those are two different questions with two different audiences:
//   LIVENESS  — is the unattended machine still executing? Dead means nothing
//               happens and nobody finds out. The heartbeat watches this.
//   CONTENT   — did this particular run's work succeed? A bad night is worth an
//               alert, but it is not the same event as a stopped job.
//
// Conflating them breaks both directions: a bad night masquerades as a dead
// cron, and — because reportFailure marks the source failing — a genuinely dead
// cron can hide behind a bad night. api/cron/directory-ingest already separates
// them; cron/newsletter-digest already uses the threshold below. scrapeflow was
// the outlier.
//
// Pure so the rule is unit-tested rather than re-derived per route.

export type RunOutcome = { status?: unknown }

/**
 * Should this run stamp the liveness clock?
 *
 * Yes when the cron executed and accomplished something — including the case
 * where there was legitimately nothing to do. A cron that correctly finds no
 * work pending has still proved it is alive, and treating that as death is the
 * exact bug that paged about owner-reports every six hours for days.
 *
 * No only when the run attempted work and ALL of it failed, which is the point
 * at which "the job is running" stops being a useful thing to report.
 */
export function shouldStampLiveness(runs: readonly RunOutcome[]): boolean {
  if (runs.length === 0) return true // nothing was due; the cron still ran
  return runs.some((run) => run.status !== 'FAILED')
}

/**
 * Should the content failure also mark the source unhealthy?
 *
 * Only when liveness was withheld. Otherwise the alert would set
 * `status: failing` on the same document the success stamp just wrote, which is
 * how a healthy job ends up looking stopped. Callers pass this as
 * reportFailure's `skipHealth` (inverted).
 */
export function failureAffectsHealth(runs: readonly RunOutcome[]): boolean {
  return !shouldStampLiveness(runs)
}
