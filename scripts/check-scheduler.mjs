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
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = join(ROOT, 'infra/scheduler/jobs.json')

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const { project, location } = manifest

let raw
try {
  raw = execFileSync(
    'gcloud',
    ['scheduler', 'jobs', 'list', '--location', location, '--project', project, '--format=json'],
    { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024 }
  )
} catch (error) {
  console.error('Could not list scheduler jobs. Are you authenticated to gcloud?')
  console.error(String(error.message || error).slice(0, 400))
  process.exit(2)
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
  }
})

if (process.argv.includes('--capture')) {
  live.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(
    MANIFEST,
    JSON.stringify({ ...manifest, jobs: live }, null, 2) + '\n',
    'utf8'
  )
  console.log(`Captured ${live.length} jobs into infra/scheduler/jobs.json`)
  process.exit(0)
}

const byName = (list) => new Map(list.map((j) => [j.name, j]))
const expected = byName(manifest.jobs)
const actual = byName(live)

const problems = []
const FIELDS = ['schedule', 'timeZone', 'uri', 'httpMethod', 'requiresCronSecret', 'attemptDeadline', 'state']

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

const paused = live.filter((j) => j.state && j.state !== 'ENABLED')
for (const j of paused) problems.push(`PAUSED    ${j.name} — state is ${j.state}, so it is not running`)

console.log(`Manifest: ${expected.size} jobs | Live: ${actual.size} jobs`)
if (problems.length === 0) {
  console.log('No drift. Every declared job exists, matches, and is enabled.')
  process.exit(0)
}
console.error(`\n${problems.length} problem(s):`)
for (const p of problems) console.error('  ' + p)
process.exit(1)
