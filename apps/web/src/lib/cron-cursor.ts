import { adminDb } from '@citybeat/lib/firebase/admin'

// Shared cursor persistence for crons that page through a large, growing
// collection (directory_listings) in a stable order across INVOCATIONS, not
// just within one run. Without this, a cron that starts every run from
// scratch (cursor = null) with no orderBy processes whatever Firestore's
// default doc-ID order happens to put first, forever — which is exactly what
// let ~4,700 ScrapeFlow-sourced listings (doc ids prefixed `sf:`, sorting
// after every legacy `osm:`-prefixed id) sit permanently unreached by
// sales-agent and enrich-contacts. Cursor value here is the ordering field's
// value on the last doc processed (e.g. a `created_at` ISO string) — callers
// reset it to null once a run reaches the true end of the collection, so the
// next run wraps back to the start and coverage cycles fairly over time.

const COLLECTION = 'cron_cursors'

export async function getCronCursor(name: string): Promise<string | null> {
  const snap = await adminDb.collection(COLLECTION).doc(name).get()
  if (!snap.exists) return null
  const value = (snap.data() as any)?.value
  return typeof value === 'string' && value ? value : null
}

export async function setCronCursor(name: string, value: string | null): Promise<void> {
  await adminDb
    .collection(COLLECTION)
    .doc(name)
    .set({ value, updated_at: new Date().toISOString() }, { merge: true })
}
