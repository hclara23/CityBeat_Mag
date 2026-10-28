import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A scheduled job's `?dryRun=1` is a PREVIEW, and the people who run one are
// doing it precisely because they are not sure what the job will do. Three ways
// it went wrong, each found in production code rather than in theory:
//
//   1. The route ignored the flag, so the "preview" ran for real. Five jobs did:
//      the social poster would have published to the Facebook Page, sync-events
//      would have deleted event rows, enrich-contacts would have written emails
//      onto listings and advanced its cursor.
//   2. The route honoured the flag but still stamped `reportSuccess`, which tells
//      the heartbeat the scheduler fired. A hand-run preview then hid a genuinely
//      stopped job for its whole staleness budget, and flipped a failing source
//      back to ok with an emailed "recovered" note although nothing ran.
//   3. The library wrote a ledger row on a dry run, and every ledger here dedupes
//      on the row's existence, so a harmless "who would you contact?" cancelled
//      the very sends it listed (covered in sales-agent-dry-run.test.ts).
//
// This test reads the real route files, so a NEW cron cannot reintroduce 1 or 2
// without somebody deciding to.

const cronDir = fileURLToPath(new URL('../app/api/cron', import.meta.url))

function routes(): Array<{ name: string; code: string }> {
  const out: Array<{ name: string; code: string }> = []
  for (const entry of readdirSync(cronDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let body: string
    try {
      body = readFileSync(join(cronDir, entry.name, 'route.ts'), 'utf8')
    } catch {
      continue
    }
    out.push({ name: entry.name, code: body })
  }
  return out
}

// Lines that actually call reportSuccess: not the import, not a comment.
function stampLines(code: string): string[] {
  return code
    .split(/\r?\n/)
    .filter((line) => /\breportSuccess\(/.test(line) && !/^\s*(\/\/|\*|import\b)/.test(line))
}

test('there are cron routes to check (a moved directory must not turn this into a pass)', () => {
  assert.ok(routes().length >= 20, `found ${routes().length} cron routes`)
})

test('every cron route reads ?dryRun=1', () => {
  const ignoring = routes()
    .filter((r) => !/searchParams\.get\(\s*'dryRun'\s*\)/.test(r.code) && !/get\(\s*'dryRun'\s*\)/.test(r.code))
    .map((r) => r.name)
  assert.deepEqual(ignoring, [], `these crons run for real when someone asks for a preview: ${ignoring.join(', ')}`)
})

// A reportSuccess that does not mention dryRun on its own line is only acceptable
// when something else already keeps a dry run from reaching it. Each exemption
// pins HOW MANY such calls the route has and says why they are safe, so adding a
// new one changes the count and fails here until a person has looked.
const REACHED_ONLY_WHEN_NOT_A_PREVIEW: Record<string, { count: number; why: string }> = {
  'checkout-recovery': { count: 1, why: 'a dry run returns its own JSON before the writes and this stamp' },
  'claims-aging': { count: 2, why: 'both sit inside `if (!dryRun) { … }`' },
  'comp-expiry': { count: 1, why: 'inside `if (!dryRun) { … }`' },
  heartbeat: { count: 4, why: 'three inside `if (!dryRun) { … }`; the fourth is the POST handler agents outside this app call, which is not a preview' },
  'payout-cycle': { count: 1, why: 'the not-a-cycle-day branch is only entered when `!dryRun`' },
  'translate-listings': { count: 1, why: 'a dry run returns its own JSON before this stamp' },
}

test('a dry run never stamps liveness', () => {
  const problems: string[] = []
  for (const r of routes()) {
    const unguarded = stampLines(r.code).filter((line) => !/dryRun/.test(line))
    const allowed = REACHED_ONLY_WHEN_NOT_A_PREVIEW[r.name]?.count ?? 0
    if (unguarded.length !== allowed) {
      problems.push(
        `${r.name}: ${unguarded.length} reportSuccess call(s) are not guarded by dryRun on their own line, expected ${allowed}. ` +
          `Guard it with \`if (!dryRun)\`, or — if a dry run genuinely cannot reach it — add it to REACHED_ONLY_WHEN_NOT_A_PREVIEW with the reason.`
      )
    }
  }
  assert.deepEqual(problems, [])
})

test('the exemptions are still real', () => {
  const names = new Set(routes().map((r) => r.name))
  for (const name of Object.keys(REACHED_ONLY_WHEN_NOT_A_PREVIEW)) {
    assert.ok(names.has(name), `${name} is exempted above but there is no such cron route`)
  }
})
