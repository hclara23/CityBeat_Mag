// One-time migration: import the bundled `localArticles` seed (apps/web/src/lib/
// localArticles.ts) into the Firestore `articles` collection so the 26 published
// stories become real, editable/deletable documents (instead of hardcoded code).
//
//   npx tsx scripts/migrate-articles-to-firestore.ts            # DRY RUN (default)
//   npx tsx scripts/migrate-articles-to-firestore.ts --apply    # writes to Firestore
//
// Requires ADC:  export GOOGLE_APPLICATION_CREDENTIALS="$APPDATA/gcloud/application_default_credentials.json"
//
// Idempotent & safe: each article is keyed by its seed `_id`. If a doc with that
// id already exists it is SKIPPED (never clobbers an article an editor has since
// modified). Run this BEFORE deploying the Firestore-authoritative sourcing change
// so /stories never has a content gap.

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { localArticles } from '../apps/web/src/lib/localArticles'

initializeApp({ credential: applicationDefault(), projectId: 'kerstenblueprint' })
const db = getFirestore()
const APPLY = process.argv.includes('--apply')

function textToBlocks(text: string) {
  return String(text || '')
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] }))
}

const catCache = new Map<string, string>()
async function getCategoryId(slug: string): Promise<string> {
  const s = slug || 'news'
  if (catCache.has(s)) return catCache.get(s)!
  const snap = await db.collection('categories').where('slug', '==', s).limit(1).get()
  let id: string
  if (!snap.empty) id = snap.docs[0].id
  else {
    const title = s.charAt(0).toUpperCase() + s.slice(1)
    if (APPLY) {
      const ref = await db.collection('categories').add({ slug: s, name_en: title, name_es: title, created_at: FieldValue.serverTimestamp() })
      id = ref.id
    } else id = `(new:${s})`
  }
  catCache.set(s, id)
  return id
}

const authorCache = new Map<string, string>()
async function getAuthorId(name: string): Promise<string> {
  const n = (name || 'CityBeat Staff').trim()
  if (authorCache.has(n)) return authorCache.get(n)!
  const snap = await db.collection('authors').where('name', '==', n).limit(1).get()
  let id: string
  if (!snap.empty) id = snap.docs[0].id
  else {
    if (APPLY) {
      const ref = await db.collection('authors').add({ name: n, created_at: FieldValue.serverTimestamp() })
      id = ref.id
    } else id = `(new:${n})`
  }
  authorCache.set(n, id)
  return id
}

async function main() {
  console.log(`${APPLY ? '=== APPLYING ===' : '=== DRY RUN (use --apply to write) ==='}`)
  console.log(`${localArticles.length} seed articles\n`)
  let created = 0
  let skipped = 0
  for (const a of localArticles as any[]) {
    const ref = db.collection('articles').doc(a._id)
    const existing = await ref.get()
    if (existing.exists) {
      console.log(`skip  (already in DB): ${a.slug}`)
      skipped++
      continue
    }
    const categoryId = await getCategoryId(a.category)
    const authorId = await getAuthorId(a.author)
    const publishedAt = a.publishedAt ? Timestamp.fromDate(new Date(a.publishedAt)) : Timestamp.now()
    const data = {
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt || '',
      content: textToBlocks(a.contentEN || a.content || ''),
      category_id: categoryId,
      author_id: authorId,
      status: 'published',
      published_at: publishedAt,
      created_at: publishedAt,
      updated_at: FieldValue.serverTimestamp(),
      image_url: a.image || null,
      cover_image_path: a.image || null,
      created_by: 'seed-import',
      seed_id: a._id,
    }
    console.log(`create: ${a.slug}  [${a.category}] by ${a.author}`)
    if (APPLY) await ref.set(data)
    created++
  }
  console.log(`\nDone. ${APPLY ? 'created' : 'would create'}=${created}, skipped=${skipped}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
