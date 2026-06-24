// Batch-translate published articles to Spanish via the worker's DeepL endpoint,
// storing title_es / excerpt_es / content_es on each Firestore doc.
//
//   # set the shared secret so the script can call the worker:
//   export GOOGLE_APPLICATION_CREDENTIALS="$APPDATA/gcloud/application_default_credentials.json"
//   export INGEST_SECRET="<the worker/web shared secret>"
//   npx tsx scripts/translate-articles.ts            # DRY RUN
//   npx tsx scripts/translate-articles.ts --apply    # writes _es fields
//   npx tsx scripts/translate-articles.ts --apply --force   # re-translate even if present
//
// Requires DEEPL_API_KEY to be set on the worker (wrangler secret put DEEPL_API_KEY).

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { buildSpanishFields } from '../apps/web/src/lib/translate'

initializeApp({ credential: applicationDefault(), projectId: 'kerstenblueprint' })
const db = getFirestore()
const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')

async function main() {
  if (!process.env.INGEST_SECRET) {
    console.error('Set INGEST_SECRET (the worker/web shared secret) before running.')
    process.exit(1)
  }
  console.log(`${APPLY ? '=== APPLYING ===' : '=== DRY RUN (use --apply) ==='}${FORCE ? ' [force]' : ''}`)
  const snap = await db.collection('articles').where('status', '==', 'published').get()
  console.log(`${snap.size} published articles\n`)

  let done = 0, skipped = 0, failed = 0
  for (const doc of snap.docs) {
    const a = doc.data() as any
    if (a.content_es && !FORCE) {
      skipped++
      continue
    }
    const es = await buildSpanishFields({ title: a.title, excerpt: a.excerpt, content: a.content })
    if (!es) {
      console.log(`FAIL  ${a.slug} (translation unavailable)`)
      failed++
      continue
    }
    console.log(`${APPLY ? 'translate' : 'would translate'}: ${a.slug}\n   -> ${(es.title_es || '').slice(0, 70)}`)
    if (APPLY) {
      await doc.ref.update({
        title_es: es.title_es,
        excerpt_es: es.excerpt_es,
        content_es: es.content_es,
        translated_at: FieldValue.serverTimestamp(),
      })
    }
    done++
  }
  console.log(`\nDone. ${APPLY ? 'translated' : 'would translate'}=${done}, skipped(existing)=${skipped}, failed=${failed}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
