#!/usr/bin/env node
// Discovers and runs every *.test.ts in the repo.
//
// The deploy gate used to run a hand-maintained list of ~43 file paths inside
// package.json's "test" script. That list is exactly the kind of thing that
// silently falls behind: a new test file only runs in CI if somebody remembers
// to append it, and nothing anywhere notices when they don't. It had already
// drifted — apps/web/src/lib/public-submissions.test.ts was committed weeks ago
// with 7 passing tests and had never once run in CI, so it could have been
// failing the whole time and the deploy gate would still have been green.
//
// Discovery removes the failure mode: write a *.test.ts anywhere and it runs.
// There is no list to forget.
//
// Tests are grouped by their nearest tsconfig.json and run with THAT directory as
// cwd, because path aliases (`@/lib/...`) only resolve against the tsconfig that
// declares them. Running everything from the repo root is what the old split into
// a separate "test:scrapeflow" script was working around; this handles it for
// every workspace instead of one hard-coded case.
//
// Usage:
//   node scripts/run-tests.mjs           run everything
//   node scripts/run-tests.mjs --list    print what would run, grouped, run nothing

import { readdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo', 'coverage'])

function findTests(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) findTests(full, out)
    else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) out.push(full)
  }
  return out
}

// Nearest ancestor holding a tsconfig.json — that is what defines this file's
// path aliases, so it is the correct cwd to run it from.
function tsconfigRootFor(file) {
  let dir = dirname(file)
  while (dir.startsWith(ROOT) && dir.length >= ROOT.length) {
    if (existsSync(join(dir, 'tsconfig.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return ROOT
}

const files = findTests(ROOT)
if (files.length === 0) {
  console.error('No test files found — that is almost certainly wrong, so failing rather than passing vacuously.')
  process.exit(1)
}

const groups = new Map()
for (const file of files) {
  const base = tsconfigRootFor(file)
  if (!groups.has(base)) groups.set(base, [])
  groups.get(base).push(relative(base, file).split(sep).join('/'))
}
for (const list of groups.values()) list.sort()

const label = (base) => relative(ROOT, base).split(sep).join('/') || '.'
console.log(`Discovered ${files.length} test files across ${groups.size} workspaces`)

if (process.argv.includes('--list')) {
  for (const [base, list] of groups) {
    console.log(`\n${label(base)}  (${list.length})`)
    for (const f of list) console.log('  ' + f)
  }
  process.exit(0)
}

let failed = 0
for (const [base, list] of groups) {
  console.log(`\n=== ${label(base)} — ${list.length} files ===`)
  const result = spawnSync('npx', ['tsx', '--test', ...list], {
    cwd: base,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) {
    console.error(`Failed to start the runner in ${label(base)}: ${result.error.message}`)
    failed = 1
  } else if (result.status !== 0) {
    failed = 1
  }
}

if (failed) console.error('\nTests FAILED')
else console.log('\nAll tests passed')
process.exit(failed)
