// Resumable cursor for a walk over `directory_listings` ordered by created_at.
//
// Shared because the SAME bug existed in two crons independently: both persisted
// the last document's created_at VALUE as the cursor, and Firestore positions
// startAfter(<value>) after EVERY document sharing that value. Every listing tied
// with the last one on a page boundary was therefore skipped - not deferred,
// skipped, and skipped again on the next run because the walk stopped at the same
// boundary every time. Bulk-scraped rows share a created_at constantly, so whole
// batches were permanently unreachable.
//
// The fix is a composite cursor: order by (created_at, __name__) and position
// with startAfter(value, docRef), which is unambiguous even across a tie.

export type ListingCursor =
  | { kind: 'string'; value: string; id: string }
  | { kind: 'timestamp'; seconds: number; nanoseconds: number; id: string }

export function encodeListingCursor(createdAt: unknown, id: string): string | null {
  if (typeof id !== 'string' || !id) return null
  if (typeof createdAt === 'string' && createdAt) {
    return JSON.stringify({ kind: 'string', value: createdAt, id })
  }
  const ts = createdAt as { seconds?: unknown; nanoseconds?: unknown } | null
  if (ts && typeof ts.seconds === 'number' && typeof ts.nanoseconds === 'number') {
    return JSON.stringify({ kind: 'timestamp', seconds: ts.seconds, nanoseconds: ts.nanoseconds, id })
  }
  // No usable created_at means no resumable position. Returning null restarts
  // the walk next run, which is safe; persisting a partial cursor is what caused
  // the bug above.
  return null
}

export function decodeListingCursor(raw: string | null | undefined): ListingCursor | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // A legacy bare-created_at cursor, written before this fix. It is precisely
    // the poisoned value that skipped the tie group, so discard it and restart
    // the walk: already-contacted listings are cheap no-ops via the
    // sales_outreach guard, and the stranded ones finally get read.
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const c = parsed as Record<'kind' | 'id' | 'value' | 'seconds' | 'nanoseconds', unknown>
  if (typeof c.id !== 'string' || !c.id) return null
  if (c.kind === 'string' && typeof c.value === 'string') {
    return { kind: 'string', value: c.value, id: c.id }
  }
  if (c.kind === 'timestamp' && typeof c.seconds === 'number' && typeof c.nanoseconds === 'number') {
    return { kind: 'timestamp', seconds: c.seconds, nanoseconds: c.nanoseconds, id: c.id }
  }
  return null
}
