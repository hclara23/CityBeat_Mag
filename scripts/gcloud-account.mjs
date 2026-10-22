// Shared gcloud account handling for the read-only infrastructure checks.
//
// WHY THIS EXISTS. This machine has two authenticated Google accounts, and only
// one of them can read the `citybeat-web` service. When the wrong one was
// active, BOTH `npm run env:check` and `npm run scheduler:check` failed with
// "Authenticated to gcloud?" — which reads like "you are logged out", so the
// natural response is to re-authenticate the account that was already logged in
// and still cannot see anything. Meanwhile the checks they gate were simply not
// running: the social job had been changed in the console to fire every ten
// minutes instead of once a day and nothing noticed, because the drift check
// could not start.
//
// The error now names the accounts that ARE authenticated and the flag to pass,
// so the next person spends a second on it rather than an afternoon.
//
// No account email is stored in the repo on purpose. The right operator differs
// per machine, emails are personal data, and a hardcoded one would be wrong for
// anybody else who clones this.

import { execFileSync } from 'node:child_process'

const WIN = process.platform === 'win32'

/** Parse `--account <email>` out of argv, rejecting a missing or flag-shaped value. */
export function accountFromArgv(argv = process.argv) {
  const index = argv.indexOf('--account')
  if (index < 0) return null
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    console.error('--account requires an authenticated Google account email')
    process.exit(2)
  }
  return value
}

/** Accounts gcloud currently holds credentials for. Returns [] if it cannot ask. */
export function authenticatedAccounts() {
  try {
    return execFileSync('gcloud', ['auth', 'list', '--format=value(account)'], {
      encoding: 'utf8',
      shell: WIN,
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Print a failure that tells the operator what to actually do, then exit 2.
 *
 * Distinguishes the two cases that look identical in gcloud's own output but
 * need opposite responses: not signed in at all (authenticate), versus signed in
 * as an account without access (switch accounts).
 */
export function explainGcloudFailure(what, error) {
  const message = String(error?.message || error)
  const denied = /PERMISSION_DENIED|does not have permission|forbidden/i.test(message)
  const accounts = authenticatedAccounts()

  console.error(`Could not ${what}.`)

  if (denied && accounts.length > 1) {
    console.error(
      `\nThis is a PERMISSIONS failure, not a sign-in failure — gcloud is authenticated, ` +
        `just as an account that cannot read this project.`
    )
    console.error(`\ngcloud currently holds credentials for:`)
    for (const account of accounts) console.error(`  ${account}`)
    console.error(`\nRe-run with the one that has access, e.g.:`)
    console.error(`  npm run ${process.env.npm_lifecycle_event || 'env:check'} -- --account <email above>`)
    console.error(`\nOr change the default for every tool:  gcloud config set account <email above>`)
  } else if (denied) {
    console.error(
      `\nThis is a PERMISSIONS failure: the active account is authenticated but cannot read this project.`
    )
  } else if (accounts.length === 0) {
    console.error(`\ngcloud has no authenticated accounts. Run:  gcloud auth login`)
  }

  console.error(`\n${message.slice(0, 400)}`)
  process.exit(2)
}
