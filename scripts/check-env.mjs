#!/usr/bin/env node
// Checks the Cloud Run service against infra/cloud-run/env.json.
//
// Production configuration existed only as hand-edited, mutable state on one
// Cloud Run service. Nothing in the repo said which variables the app needs, so:
//   - a variable dropped or mistyped in the console fails at REQUEST time, in
//     production, in whichever feature happens to touch it first — not at deploy
//   - several of them fail SILENTLY. No ANTHROPIC_API_KEY and the newsroom,
//     concierge and sales agent simply stop producing. No RESEND_API_KEY and
//     alerts are written to Firestore and nobody is ever told.
//   - rebuilding the project from source would rebuild the app and none of its
//     configuration
//
// VALUES ARE NEVER READ OR PRINTED. This compares NAMES only.
//
//   node scripts/check-env.mjs            compare live against the manifest
//   node scripts/check-env.mjs --names    list live variable names, nothing else

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(ROOT, 'infra/cloud-run/env.json'), 'utf8'))
const { service, project, region } = manifest

let raw
try {
  raw = execFileSync(
    'gcloud',
    [
      'run', 'services', 'describe', service,
      '--project', project, '--region', region,
      // Ask gcloud for names only, so no secret value is ever fetched.
      '--format=value(spec.template.spec.containers[0].env[].name)',
    ],
    { encoding: 'utf8', shell: process.platform === 'win32' }
  )
} catch (error) {
  console.error('Could not describe the Cloud Run service. Authenticated to gcloud?')
  console.error(String(error.message || error).slice(0, 400))
  process.exit(2)
}

const live = new Set(
  raw.split(/[;\s,]+/).map((s) => s.trim()).filter(Boolean)
)

if (process.argv.includes('--names')) {
  console.log([...live].sort().join('\n'))
  process.exit(0)
}

const required = Object.keys(manifest.required || {})
const degrades = Object.keys(manifest.degradesQuietly || {})
const optional = Object.keys(manifest.optional || {})
const known = new Set([...required, ...degrades, ...optional])

const missingRequired = required.filter((n) => !live.has(n))
const missingQuiet = degrades.filter((n) => !live.has(n))
const undeclared = [...live].filter((n) => !known.has(n)).sort()

console.log(`Service ${service}: ${live.size} variables set`)

if (missingRequired.length) {
  console.error('\nMISSING AND REQUIRED — the app is broken or about to be:')
  for (const n of missingRequired) console.error(`  ${n}\n      ${manifest.required[n]}`)
}
if (missingQuiet.length) {
  console.error('\nMISSING, FAILS QUIETLY — a feature is off and nothing will say so:')
  for (const n of missingQuiet) console.error(`  ${n}\n      ${manifest.degradesQuietly[n]}`)
}
if (undeclared.length) {
  console.warn('\nSET BUT UNDECLARED — add it to infra/cloud-run/env.json or remove it:')
  for (const n of undeclared) console.warn(`  ${n}`)
}

if (!missingRequired.length && !missingQuiet.length && !undeclared.length) {
  console.log('No drift. Every declared variable is set and every set variable is declared.')
}

// Only a missing REQUIRED variable is a failure. A quiet degradation and an
// undeclared extra are reported loudly but do not block, because this is meant to
// be runnable during an incident without becoming another thing that is red.
process.exit(missingRequired.length ? 1 : 0)
