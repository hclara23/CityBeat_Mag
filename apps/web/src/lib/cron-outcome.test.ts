import { test } from 'node:test'
import assert from 'node:assert/strict'
import { failureAffectsHealth, shouldStampLiveness } from './cron-outcome'

// The incident: citybeat-scrapeflow paged "1 scheduled job(s) have stopped
// running — last ran 39h ago" while the job had run two hours earlier and
// processed workflows normally. One workflow of several had failed, and the
// route only stamped liveness in the else branch.

const ok = { status: 'COMPLETED' }
const bad = { status: 'FAILED' }

test('one failing workflow does not mean the cron stopped running', () => {
  // This is the whole bug, in one assertion.
  assert.equal(shouldStampLiveness([ok, ok, bad]), true)
  assert.equal(shouldStampLiveness([bad, ok]), true)
})

test('a run with nothing due still proves the cron is alive', () => {
  // Treating "no work pending" as death is the bug that paged about
  // owner-reports every six hours for days.
  assert.equal(shouldStampLiveness([]), true)
})

test('a run where everything failed does NOT stamp liveness', () => {
  // The threshold has to mean something. If nothing at all succeeded, "the job
  // is running" has stopped being a useful thing to report.
  assert.equal(shouldStampLiveness([bad]), false)
  assert.equal(shouldStampLiveness([bad, bad, bad]), false)
})

test('an unknown status counts as success, not failure', () => {
  // Only 'FAILED' is a failure. A new status string added to the engine later
  // must not silently start suppressing the liveness stamp — that is how this
  // class of bug comes back.
  assert.equal(shouldStampLiveness([{ status: 'RUNNING' }]), true)
  assert.equal(shouldStampLiveness([{ status: undefined }]), true)
  assert.equal(shouldStampLiveness([{}]), true)
})

test('the content alert only marks the source unhealthy when liveness was withheld', () => {
  // Otherwise reportFailure sets status:failing on the very document the
  // success stamp just wrote, and a healthy job reads as stopped — which is
  // precisely what the live system_health doc showed:
  //   last_run_at 2026-10-22, last_failure_at 2026-10-24, status 'failing'.
  assert.equal(failureAffectsHealth([ok, bad]), false, 'partial failure: alert, but stay alive')
  assert.equal(failureAffectsHealth([bad]), true, 'total failure: the source really is unhealthy')
  assert.equal(failureAffectsHealth([]), false)
})

test('the two rules can never disagree', () => {
  // They are inverses by definition; a future edit that breaks that would let a
  // run both stamp success and mark itself failing.
  for (const runs of [[], [ok], [bad], [ok, bad], [bad, bad], [ok, ok, ok]]) {
    assert.equal(shouldStampLiveness(runs), !failureAffectsHealth(runs))
  }
})
