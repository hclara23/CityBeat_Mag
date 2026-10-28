import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// A one-document "something that affects search changed" marker.
//
// The search index (lib/directory-search.ts) is rebuilt by re-reading every
// published listing, so how often it rebuilds IS the Firestore bill. Rebuilding
// on a fixed 15-minute clock was ~96 full reads a day against a directory whose
// rows change a few times a day. The clock is now hours; this marker is what
// makes that safe: a write that changes who matches or how they rank (a tier
// change, a claim decision, a bulk publish, an edit) bumps it, and the cache
// notices on its next probe instead of waiting out the clock.
//
// Best-effort by construction. A bump that fails costs one stale interval, never
// the write that triggered it, so this swallows every error.

const ref = () => adminDb.collection('search_index_state').doc('directory')

export async function bumpDirectoryIndexVersion(reason: string): Promise<void> {
  try {
    await ref().set(
      { version: FieldValue.increment(1), last_reason: String(reason).slice(0, 120), bumped_at: new Date().toISOString() },
      { merge: true }
    )
  } catch {
    /* a missed bump only delays freshness to the next scheduled rebuild */
  }
}

/** Current marker value; '0' before the first bump. Throws on a read failure so
 *  the cache can tell "unchanged" from "could not check". */
export async function readDirectoryIndexVersion(): Promise<string> {
  const snap = await ref().get()
  return snap.exists ? String((snap.data() as { version?: unknown }).version ?? 0) : '0'
}
