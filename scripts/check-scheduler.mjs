#!/usr/bin/env node
// Drift check between infra/scheduler/jobs.json and what is actually deployed.
//
// The 19 Cloud Scheduler jobs run the entire money and growth engine — payout
// cycles, Stripe reconciliation, referral qualification, outbound sales. Until
// this file they existed ONLY as mutable cloud state: nothing in the repo said
// which jobs should exist, on what schedule, pointing where. Consequences that
// nothing would have caught:
//   - a job deleted or paused by accident is silently gone forever; there is no
//     list to compare against, and a job that stops running produces no signal
//   - a schedule edited in the console leaves no trace and no review
//   - rebuilding the project from source would rebuild the app and none of the
//     automation around it
//
// This does not create or modify anything. It reports drift, so a human decides.
//
//   node scripts/check-scheduler.mjs           compare live against the manifest
//   node scripts/check-scheduler.mjs --capture rewrite the manifest from live
//                                              (use ONLY after a deliberate change)

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { accountFromArgv, explainGcloudFailure } from './gcloud-account.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = join(ROOT, 'infra/scheduler/jobs.json')

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const { project, location } = manifest
// Parity with check-env: name the operator without changing gcloud's global
// account. Two accounts are authenticated here and only one can read the project.
const account = accountFromArgv()

let raw
try {
  raw = execFileSync(
    'gcloud',
    [
      'scheduler', 'jobs', 'list',
      '--location', location, '--project', project,
      ...(account ? ['--account', account] : []),
      '--format=json',
    ],
    { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024 }
  )
} catch (error) {
  explainGcloudFailure('list scheduler jobs', error)
}

const live = JSON.parse(raw).map((j) => {
  const target = j.httpTarget || {}
  return {
    name: j.name.split('/').pop(),
    schedule: j.schedule,
    timeZone: j.timeZone,
    uri: target.uri,
    httpMethod: target.httpMethod,
    // Only ever the PRESENCE of the header, never its value.
    requiresCronSecret: Boolean((target.headers || {}).Authorization),
    attemptDeadline: j.attemptDeadline,
    retryConfig: j.retryConfig,
    state: j.state,
    // Outcome of the LAST scheduled run. These come free in the same `jobs list`
    // response and used to be discarded, which is why this check could report
    // "No drift" about a job that had failed on every run it ever made. They are
    // deliberately kept OUT of the manifest below: a run outcome is not declared
    // intent, and capturing it would make today's failure tomorrow's expected
    // state — the same trap that let a wrong schedule become the declared one.
    lastAttemptTime: j.lastAttemptTime,
    lastStatusCode: (j.status || {}).code,
    lastStatusMessage: (j.status || {}).message,
  }
})

// Fields describing a job's CONFIGURATION, and so the only ones captured.
const MANIFEST_FIELDS = [
  'name', 'schedule', 'timeZone', 'uri', 'httpMethod',
  'requiresCronSecret', 'attemptDeadline', 'retryConfig', 'state',
]
const configOnly = (job) =>
  Object.fromEntries(MANIFEST_FIELDS.filter((f) => job[f] !== undefined).map((f) => [f, job[f]]))

if (process.argv.includes('--capture')) {
  live.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(
    MANIFEST,
    JSON.stringify({ ...manifest, jobs: live.map(configOnly) }, null, 2) + '\n',
    'utf8'
  )
  console.log(`Captured ${live.length} jobs into infra/scheduler/jobs.json`)
  process.exit(0)
}

const byName = (list) => new Map(list.map((j) => [j.name, j]))
const expected = byName(manifest.jobs)
const actual = byName(live)

const problems = []
// retryConfig is compared now, not merely checked for a non-zero count: a retry
// policy weakened in the console — backoff stretched past the attempt deadline,
// maxDoublings dropped — previously left no trace here at all.
const FIELDS = ['schedule', 'timeZone', 'uri', 'httpMethod', 'requiresCronSecret', 'attemptDeadline', 'state', 'retryConfig']

for (const [name, want] of expected) {
  const got = actual.get(name)
  if (!got) {
    problems.push(`MISSING   ${name} — declared in the manifest but does not exist. Nothing is running it.`)
    continue
  }
  for (const field of FIELDS) {
    const a = JSON.stringify(want[field])
    const b = JSON.stringify(got[field])
    if (a !== b) problems.push(`DRIFT     ${name}.${field}: manifest ${a} vs live ${b}`)
  }
  // A retry count of 0 means a single transient failure loses that run entirely.
  const retries = (got.retryConfig || {}).retryCount
  if (!retries) problems.push(`NO RETRY  ${name} — retryCount is ${retries}; one blip loses the run`)
}

for (const name of actual.keys()) {
  if (!expected.has(name)) {
    problems.push(`UNDECLARED ${name} — exists in the cloud but not in the manifest. Add it or delete it.`)
  }
}

// A pause is only a problem when NOBODY DECLARED IT. This file exists because
// "a job deleted or paused by accident is silently gone forever"; a pause the
// manifest also records is the opposite of an accident, it is written-down
// intent. Flagging it anyway left a permanently-red check, which is the same
// trap as a permanently-red alert — it teaches whoever reads this output to
// skim past it. A declared/live state MISMATCH is still caught, because
// 'state' is one of the FIELDS compared for drift above.
const paused = live.filter((j) => j.state && j.state !== 'ENABLED')
for (const j of paused) {
  const declared = expected.get(j.name)
  if (declared && declared.state && declared.state !== 'ENABLED') continue // deliberate, and recorded
  problems.push(`PAUSED    ${j.name} — state is ${j.state}, so it is not running`)
}

// The question the manifest structurally CANNOT answer: did the last run work?
// CLAUDE.md's rule "verify a job by its OWN recorded outcome, not by calling it
// by hand" exists because citybeat-reconcile-orders returned 500 on every
// scheduled run since creation while a hand-run dry-run looked fine. That rule
// was documented as a manual gcloud incantation and implemented nowhere. This is
// it. A non-empty status.code means the last attempt FAILED (13 = INTERNAL).
for (const j of live) {
  if (j.lastStatusCode === undefined || j.lastStatusCode === null) continue
  // A paused job keeps the status.code of the run that made someone pause it,
  // so reporting it forever would re-raise an incident that has been closed
  // and recorded. Only a job that is still SCHEDULED to run can have a
  // meaningfully failing last run.
  if (j.state && j.state !== 'ENABLED') continue
  const when = j.lastAttemptTime ? ` at ${j.lastAttemptTime}` : ''
  const why = j.lastStatusMessage ? ` — ${String(j.lastStatusMessage).slice(0, 140)}` : ''
  problems.push(
    `LAST RUN FAILED ${j.name} — status.code ${j.lastStatusCode}${when}${why}. ` +
      `The schedule is right and the job IS running; its target answered with an error.`
  )
}

// Not drift, but the state a newly created job sits in when its schedule is
// wrong or its target has 404'd since the day it was made.
for (const j of live) {
  if (j.state === 'ENABLED' && !j.lastAttemptTime) {
    problems.push(`NEVER RAN ${j.name} — enabled, but has no lastAttemptTime. Nothing has invoked it.`)
  }
}

console.log(`Manifest: ${expected.size} jobs | Live: ${actual.size} jobs`)
if (problems.length === 0) {
  const declaredPaused = [...expected.values()].filter((j) => j.state && j.state !== 'ENABLED').map((j) => j.name)
  console.log(
    'No drift. Every declared job exists and matches' +
      (declaredPaused.length
        ? `, and the ${declaredPaused.length} deliberately paused (${declaredPaused.join(', ')}) ${declaredPaused.length === 1 ? 'is' : 'are'} paused as declared.`
        : ', and every one is enabled.')
  )
  process.exit(0)
}
console.error(`\n${problems.length} problem(s):`)
for (const p of problems) console.error('  ' + p)
process.exit(1)
