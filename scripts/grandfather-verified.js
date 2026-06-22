// One-time: mark all EXISTING Firebase Auth users as email-verified so the new
// "verified email required to sign in" rule doesn't lock out current accounts
// (admins, seeded users, etc.). New signups still go through verification.
//
//   node scripts/grandfather-verified.js

const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp({ credential: applicationDefault(), projectId: 'kerstenblueprint' })
const auth = getAuth()
const db = getFirestore()

async function main() {
  let next
  let verified = 0
  let already = 0
  do {
    const page = await auth.listUsers(1000, next)
    for (const u of page.users) {
      if (u.emailVerified) {
        already++
        continue
      }
      await auth.updateUser(u.uid, { emailVerified: true })
      await db.collection('profiles').doc(u.uid).set({ email_verified: true }, { merge: true }).catch(() => {})
      verified++
      console.log('verified:', u.email || u.uid)
    }
    next = page.pageToken
  } while (next)
  console.log(`\nDone. Newly verified: ${verified}, already verified: ${already}.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1) })
