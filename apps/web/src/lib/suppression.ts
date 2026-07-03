import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// Global marketing-email suppression list. Every marketing sender (outreach,
// upsell, recovery) must check this before sending; unsubscribes, hard bounces,
// and spam complaints all land here. Transactional email (verification codes,
// dunning, receipts, owner reports) is exempt by design.

const COLLECTION = 'email_suppressions'

const norm = (email: string) => email.trim().toLowerCase()

export async function isSuppressed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  try {
    const doc = await adminDb.collection(COLLECTION).doc(norm(email)).get()
    return doc.exists
  } catch {
    return false // fail-open: a read hiccup shouldn't block the whole run
  }
}

export async function suppress(email: string | null | undefined, source: string): Promise<void> {
  if (!email || !email.includes('@')) return
  try {
    await adminDb.collection(COLLECTION).doc(norm(email)).set(
      { email: norm(email), source, created_at: FieldValue.serverTimestamp() },
      { merge: true }
    )
  } catch {
    /* best effort */
  }
}
