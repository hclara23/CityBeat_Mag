// Read-only survey of directory_listings in production Firestore.
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp({
  credential: applicationDefault(),
  projectId: 'kerstenblueprint',
})

const db = getFirestore()

function normName(n) {
  return String(n || '')
    .toLowerCase()
    .replace(/[#\d].*$/, '') // drop store numbers / suffixes like "#1234"
    .replace(/\b(el paso|juarez|ciudad juarez|las cruces|tx|nm|inc|llc|co)\b/g, '')
    .replace(/[^a-z]/g, '')
    .trim()
}

async function main() {
  const snap = await db.collection('directory_listings').get()
  console.log('TOTAL listings:', snap.size)

  const groups = new Map()
  for (const d of snap.docs) {
    const data = d.data()
    const key = normName(data.name)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ id: d.id, name: data.name, address: data.address, category: data.category })
  }

  const dups = [...groups.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length)
  console.log('DUPLICATE brand groups (>=2 locations):', dups.length)
  console.log('Top 25 by location count:')
  for (const [key, v] of dups.slice(0, 25)) {
    console.log(`  ${v.length.toString().padStart(3)}  ${v[0].name}  [${key}]`)
  }

  // Sample field shape of one doc
  const sample = snap.docs[0]?.data() || {}
  console.log('\nSAMPLE doc fields:', Object.keys(sample).sort().join(', '))
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1) })
