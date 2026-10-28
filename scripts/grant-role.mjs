// Grant or revoke a platform role on a profile.
//
//   node scripts/grant-role.mjs --email someone@example.com --roles editor
//   node scripts/grant-role.mjs --email someone@example.com --roles editor --apply
//   node scripts/grant-role.mjs --email someone@example.com --revoke --apply
//   node scripts/grant-role.mjs --list
//
// WHY THIS EXISTS
//
// The platform has seven roles and, until this file, no way to give one to
// anybody. /api/platform/roles can set them, but its GET is a self-read and no
// page in the app calls its PATCH — so onboarding a second human was impossible
// without editing Firestore by hand, and editing Firestore by hand is how an
// account ends up with godmode nobody meant to grant. Exactly two production
// profiles had elevated access and no process existed to make a third.
//
// SAFETY
//
//   - DRY RUN by default. Nothing is written without --apply.
//   - Refuses to grant 'developer' or 'admin'. Those are godmode and
//     near-godmode; granting them is a deliberate act that should be visible in
//     the console, not something a script does on one flag. canManageRole
//     already forbids a non-developer from granting them through the API, and
//     this mirrors that rule rather than quietly providing a way around it.
//   - Writes `granted_roles` only. It never touches `role`, `is_developer` or
//     `can_manage_platform`, so it cannot escalate an account past the role
//     being granted.
//   - Every change is written to directory_audit_log, because a privilege grant
//     with no record is the one write you most want a trail for.
//
// Run it with the authorized gcloud account active (see scripts/gcloud-account.mjs).

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Mirrors PLATFORM_ROLES in packages/lib/src/roles.ts. Duplicated deliberately:
// this script must run without the workspace's TypeScript path aliases.
const PLATFORM_ROLES = ['developer', 'admin', 'editor', 'writer', 'contributor', 'sales', 'advertiser']
const REFUSED = ['developer', 'admin']

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null
}
const has = (name) => args.includes(`--${name}`)

const APPLY = has('apply')
const email = flag('email')
const roles = (flag('roles') || '').split(',').map((r) => r.trim()).filter(Boolean)

if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'kerstenblueprint' })
const db = getFirestore()

function usage(message) {
  if (message) console.error(`\n${message}\n`)
  console.error(`Usage:
  node scripts/grant-role.mjs --list
  node scripts/grant-role.mjs --email <address> --roles <role[,role]> [--apply]
  node scripts/grant-role.mjs --email <address> --revoke [--apply]

Grantable roles: ${PLATFORM_ROLES.filter((r) => !REFUSED.includes(r)).join(', ')}
Refused here:    ${REFUSED.join(', ')} (grant those in the console, deliberately)`)
  process.exit(message ? 1 : 0)
}

async function listStaff() {
  const snap = await db.collection('profiles').get()
  const rows = []
  snap.forEach((doc) => {
    const d = doc.data() || {}
    const granted = Array.isArray(d.granted_roles) ? d.granted_roles : []
    const elevated =
      d.is_developer || d.can_manage_platform || d.is_editor || d.is_sales || d.is_writer ||
      (d.role && d.role !== 'reader') || granted.length
    if (elevated) rows.push({ id: doc.id, email: d.email || '(no email)', role: d.role || null, granted })
  })
  console.log(`\n${rows.length} profile(s) with any elevated access:\n`)
  for (const r of rows.sort((a, b) => String(a.email).localeCompare(String(b.email)))) {
    console.log(`  ${String(r.email).padEnd(34)} role=${String(r.role).padEnd(11)} granted=[${r.granted.join(', ')}]`)
    console.log(`    id ${r.id}`)
  }
  console.log(`\n${snap.size} profiles in total.`)
}

async function main() {
  if (has('help') || (!email && !has('list'))) usage()
  if (has('list')) return listStaff()

  const revoking = has('revoke')
  if (!revoking) {
    if (!roles.length) usage('--roles is required unless you pass --revoke')
    const unknown = roles.filter((r) => !PLATFORM_ROLES.includes(r))
    if (unknown.length) usage(`Unknown role(s): ${unknown.join(', ')}`)
    const refused = roles.filter((r) => REFUSED.includes(r))
    if (refused.length) {
      usage(
        `Refusing to grant ${refused.join(', ')}. That is godmode or near-godmode; ` +
          `grant it in the Firebase console so the act is visible and deliberate.`
      )
    }
  }

  const snap = await db.collection('profiles').where('email', '==', email).limit(2).get()
  if (snap.empty) usage(`No profile with email ${email}. They must sign in once before a role can be granted.`)
  if (snap.size > 1) {
    usage(
      `${snap.size} profiles share ${email}. Resolve the duplicate first — granting to one of two ` +
        `accounts with the same address is how an operator ends up signed in to the wrong one.`
    )
  }

  const doc = snap.docs[0]
  const current = doc.data() || {}
  const before = Array.isArray(current.granted_roles) ? current.granted_roles : []
  const after = revoking ? [] : [...new Set([...before, ...roles])]

  console.log(`\nProfile ${doc.id}  (${email})`)
  console.log(`  role            ${current.role || '(none)'}`)
  console.log(`  granted_roles   [${before.join(', ')}]  ->  [${after.join(', ')}]`)
  if (current.is_developer || current.can_manage_platform) {
    console.log('  NOTE: this account already has developer/godmode; granted_roles changes nothing for it.')
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to make this change.')
    return
  }

  await doc.ref.set({ granted_roles: after }, { merge: true })
  await db.collection('directory_audit_log').add({
    action: revoking ? 'platform_roles_revoked' : 'platform_roles_granted',
    actor: 'scripts/grant-role.mjs',
    target_profile_id: doc.id,
    target_email: email,
    roles_before: before,
    roles_after: after,
    created_at: new Date().toISOString(),
  })
  console.log('\nApplied, and recorded in directory_audit_log.')
}

main().catch((error) => {
  const message = String(error?.message || error)
  console.error(`\nFailed: ${message}`)
  // PERMISSION_DENIED here is almost always the two-accounts trap CLAUDE.md
  // documents. This uses Application Default Credentials, which are set
  // SEPARATELY from `gcloud config set account` — so having the authorized
  // account active does not mean ADC points at it. Without this note the error
  // reads as "you lack access to the project", which sends an operator to look
  // at IAM instead of at their own credentials.
  if (/PERMISSION_DENIED|default credentials|UNAUTHENTICATED/i.test(message)) {
    console.error(
      '\nThis script authenticates with Application Default Credentials, which are\n' +
        'separate from the account `gcloud config set account` selects. Point ADC at\n' +
        'the authorized account and retry:\n\n' +
        '  gcloud auth application-default login\n\n' +
        'To see which accounts are authenticated: node scripts/gcloud-account.mjs'
    )
  }
  process.exit(1)
})
