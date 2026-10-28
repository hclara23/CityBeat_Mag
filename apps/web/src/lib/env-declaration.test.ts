import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Why this exists.
//
// CLAUDE.md states the repository's own defence against drift-by-snapshot: a
// manifest captured FROM live "becomes the declared intent and scheduler:check
// reports 'no drift' forever after" — which is how citybeat-ghost-reports ran
// monthly for months while the docs said daily. The fix there was a SECOND,
// independent description plus a test that fails when the two disagree
// (cron-cadence.test.ts).
//
// Environment variables had the first half and not the second. The only guard
// was `npm run env:check`, which needs live gcloud credentials, runs
// non-blocking, and cannot start at all when the wrong Google account is
// active — a failure mode CLAUDE.md documents as having already hidden a cron
// running 144x a day.
//
// This is the half of that check which needs no credentials: every
// `process.env.X` the deployed container reads must be declared in
// infra/cloud-run/env.json. It runs in CI, on every `npm test`, and it is how
// ALERT_EMAIL/SALES_REPLY_EMAIL stay documented once someone edits them.
//
// It deliberately does NOT assert the live service's contents. "Declared but
// not set" is a legitimate state for an optional variable and only gcloud can
// see it; env:check still owns that direction.

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))

// Mirrors SCANNED_TREES in scripts/check-env.mjs. Exactly the trees that run
// inside the Cloud Run container: `scripts/` is local tooling and
// services/worker is a Cloudflare Worker with its own wrangler secrets, so
// either would be a false positive against a Cloud Run manifest.
const SCANNED_TREES = ['apps/web/src', 'packages/lib/src']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build'])

function envNamesReferencedInCode(dir: string, out = new Map<string, string>()): Map<string, string> {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) envNamesReferencedInCode(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      // Tests set and read env vars to exercise fallbacks; those are not
      // deployment configuration and must not require a declaration.
      if (/\.test\.(ts|tsx)$/.test(entry.name)) continue
      const body = readFileSync(full, 'utf8')
      for (const m of body.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        if (!out.has(m[1])) out.set(m[1], full.slice(ROOT.length).replace(/\\/g, '/'))
      }
    }
  }
  return out
}

function manifest() {
  return JSON.parse(readFileSync(join(ROOT, 'infra/cloud-run/env.json'), 'utf8'))
}

function declaredNames(m: ReturnType<typeof manifest>): Set<string> {
  return new Set([
    ...Object.keys(m.required || {}),
    ...Object.keys(m.degradesQuietly || {}),
    ...Object.keys(m.optional || {}),
    ...Object.keys(m.platformProvided || {}),
  ])
}

test('the env manifest is valid and non-trivial', () => {
  const m = manifest()
  assert.ok(Object.keys(m.required || {}).length > 0, 'required must not be empty')
  const names = declaredNames(m)
  assert.ok(names.size >= 40, `expected a real inventory, found ${names.size} names`)
  // Every declaration must carry a reason, not just a name — the manifest's
  // value is the "what breaks without it" text, which is what a reader acts on.
  for (const bucket of ['required', 'degradesQuietly', 'optional', 'platformProvided']) {
    for (const [name, why] of Object.entries(m[bucket] || {})) {
      assert.equal(typeof why, 'string', `${name} must have a description`)
      assert.ok(String(why).trim().length >= 10, `${name}'s description is too thin to be useful`)
    }
  }
})

test('no variable is declared in two buckets at once', () => {
  const m = manifest()
  const seen = new Map<string, string>()
  const clashes: string[] = []
  for (const bucket of ['required', 'degradesQuietly', 'optional', 'platformProvided']) {
    for (const name of Object.keys(m[bucket] || {})) {
      const prior = seen.get(name)
      if (prior) clashes.push(`${name}: ${prior} and ${bucket}`)
      else seen.set(name, bucket)
    }
  }
  // A name in two buckets means two different answers to "does absence break
  // production?", and check-env.mjs reads them into one set, so the
  // contradiction would never surface there.
  assert.deepEqual(clashes, [], `declared in more than one bucket:\n  ${clashes.join('\n  ')}`)
})

test('every env var the container reads is declared in the manifest', () => {
  const declared = declaredNames(manifest())
  const referenced = new Map<string, string>()
  for (const tree of SCANNED_TREES) envNamesReferencedInCode(join(ROOT, tree), referenced)

  // Sanity-check the scanner itself: a silent zero would make this test pass
  // forever while checking nothing, which is the failure mode it exists to stop.
  assert.ok(referenced.size >= 20, `scanner found only ${referenced.size} env references — it is probably broken`)
  assert.ok(referenced.has('ALERT_EMAIL'), 'scanner should see ALERT_EMAIL')

  const undeclared = [...referenced.entries()]
    .filter(([name]) => !declared.has(name))
    .map(([name, where]) => `${name} (read by ${where})`)
    .sort()

  assert.deepEqual(
    undeclared,
    [],
    `read by code but not declared in infra/cloud-run/env.json:\n  ${undeclared.join('\n  ')}`
  )
})

test('the two addresses ALERT_EMAIL used to serve are declared separately', () => {
  // The specific confusion this file was added alongside: ALERT_EMAIL is the
  // operator's alert destination (a LIST, defaulting to a personal address) and
  // was also read as the reply address PRINTED into customer email. Both roles
  // must stay documented, and distinctly, or the next person sets one variable
  // and silently edits commercial copy.
  const m = manifest()
  const all = { ...(m.required || {}), ...(m.degradesQuietly || {}), ...(m.optional || {}), ...(m.platformProvided || {}) }

  assert.ok(all.ALERT_EMAIL, 'ALERT_EMAIL must be declared')
  assert.match(String(all.ALERT_EMAIL), /operator/i, 'ALERT_EMAIL must say it is operator-facing')
  assert.match(String(all.ALERT_EMAIL), /list/i, 'ALERT_EMAIL must say it accepts a list')

  assert.ok(all.SALES_REPLY_EMAIL, 'SALES_REPLY_EMAIL must be declared')
  assert.match(String(all.SALES_REPLY_EMAIL), /customer/i, 'SALES_REPLY_EMAIL must say it is customer-facing')
})
