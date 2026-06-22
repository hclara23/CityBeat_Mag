// Consolidate duplicate brand listings into one multi-location listing.
//
//   node scripts/consolidate-listings.js            # DRY RUN (default) — prints plan
//   node scripts/consolidate-listings.js --apply     # executes the merge
//
// For each group of same-brand listings:
//   - pick a CANONICAL doc (most complete; a claimed doc always wins)
//   - merge every member's address into canonical.locations[]
//   - set location_count / is_multi_location on the canonical
//   - UNPUBLISH siblings (is_published=false, merged_into=<canonicalId>) — reversible
//
// Safety: a group is SKIPPED if more than one member is claimed (owner_id set),
// to avoid disturbing paying owners.

const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp({ credential: applicationDefault(), projectId: 'kerstenblueprint' })
const db = getFirestore()

const APPLY = process.argv.includes('--apply')

function normName(n) {
  return String(n || '')
    .toLowerCase()
    .replace(/[#\d].*$/, '')
    .replace(/\b(el paso|juarez|ciudad juarez|las cruces|tx|nm|inc|llc|co)\b/g, '')
    .replace(/[^a-z]/g, '')
    .trim()
}

function score(d) {
  let s = 0
  if (d.owner_id) s += 100
  if (d.description) s += 3
  if (d.website) s += 2
  if (d.phone) s += 1
  if (d.image_url) s += 1
  if (d.hours && Object.keys(d.hours).length) s += 1
  s += Number(d.user_ratings_total || 0) / 1000
  return s
}

function locationOf(d) {
  return {
    address: d.address || null,
    phone: d.phone || null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    google_place_id: d.google_place_id || null,
  }
}

async function main() {
  const snap = await db.collection('directory_listings').get()
  const groups = new Map()
  for (const doc of snap.docs) {
    const data = { id: doc.id, ...doc.data() }
    if (data.merged_into) continue // already consolidated
    const key = normName(data.name)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(data)
  }

  const dups = [...groups.values()].filter((v) => v.length > 1)
  let mergedGroups = 0
  let unpublished = 0
  let skipped = 0

  for (const members of dups) {
    const claimed = members.filter((m) => m.owner_id)
    if (claimed.length > 1) {
      console.log(`SKIP  ${members[0].name} (${members.length}) — multiple claimed owners`)
      skipped++
      continue
    }

    const canonical = [...members].sort((a, b) => score(b) - score(a))[0]
    const siblings = members.filter((m) => m.id !== canonical.id)

    // Build deduped locations from every member.
    const seen = new Set()
    const locations = []
    for (const m of members) {
      const addr = (m.address || '').trim().toLowerCase()
      if (!addr || seen.has(addr)) continue
      seen.add(addr)
      locations.push(locationOf(m))
    }

    console.log(
      `MERGE ${canonical.name}  → canonical ${canonical.id}  | ${locations.length} locations | unpublish ${siblings.length}`
    )

    if (APPLY) {
      await db.collection('directory_listings').doc(canonical.id).set(
        {
          locations,
          location_count: locations.length,
          is_multi_location: true,
          is_published: true,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      for (const s of siblings) {
        await db.collection('directory_listings').doc(s.id).set(
          {
            is_published: false,
            merged_into: canonical.id,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        unpublished++
      }
    } else {
      unpublished += siblings.length
    }
    mergedGroups++
  }

  console.log(
    `\n${APPLY ? 'APPLIED' : 'DRY RUN'}: ${mergedGroups} groups merged, ${unpublished} siblings unpublished, ${skipped} skipped`
  )
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1) })
