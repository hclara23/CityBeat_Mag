import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { pointsFor, type PointEvent } from './points'

// Atomic, idempotent, audited point awards. Each award writes ONE ledger doc
// with a deterministic id (event + source), and only credits the profile when
// that ledger doc is newly created — so a retry, a double-submit, or a webhook
// redelivery can never double-award. Replaces the old get-then-set on
// profiles.review_points, which had no idempotency beyond the caller's own
// duplicate guard.
export async function awardPoints(input: {
  userId: string
  event: PointEvent
  // Stable per-source id so the same review/photo can't be paid twice.
  sourceId: string
  // Advertisers earn nothing (they shouldn't rank as "top reviewers").
  isAdvertiser?: boolean
  meta?: Record<string, unknown>
}): Promise<{ awarded: number }> {
  const amount = pointsFor(input.event)
  if (!input.userId || amount <= 0 || input.isAdvertiser) return { awarded: 0 }

  const ledgerId = `${input.event}:${input.sourceId}`.replace(/\//g, '_').slice(0, 400)
  const ledgerRef = adminDb.collection('points_ledger').doc(ledgerId)
  const profileRef = adminDb.collection('profiles').doc(input.userId)

  try {
    const created = await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(ledgerRef)
      if (existing.exists) return false
      tx.create(ledgerRef, {
        user_id: input.userId,
        event: input.event,
        source_id: input.sourceId,
        points: amount,
        ...(input.meta ? { meta: input.meta } : {}),
        created_at: FieldValue.serverTimestamp(),
      })
      tx.set(profileRef, { review_points: FieldValue.increment(amount) }, { merge: true })
      return true
    })
    return { awarded: created ? amount : 0 }
  } catch {
    // A point award must never fail the user's actual action (review, upload).
    return { awarded: 0 }
  }
}
