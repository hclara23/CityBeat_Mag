// Where the nightly commission reconciliation left off (pure, unit-tested — no
// Firestore, no Next imports).
//
// reconcileFailedTransfers scans `transfers` rows in `failed` and
// `skipped_no_connected_account`. It used to do so with a bare `.limit(n)` and no
// ordering at all: Firestore then orders by __name__, so the job read the SAME
// first n document ids every single night. Once n chronically unpayable rows sit
// at the head of that ordering — a payee who has never connected a bank is not
// going to connect one tonight either — every row BEHIND them is never examined
// again. A rep's earned commission can sit unpaid forever while the job reports
// success, because "scanned 50, paid 0" is exactly what a healthy quiet night
// looks like too. These helpers are what make the window advance instead of
// resetting to the front of the same pile on every run.
//
// The ordering key is __name__ and nothing else. Ordering by a data field —
// created_at, last_attempt_at — reads better and is a trap: rows written by
// runPayoutCycle use set({ status }, { merge: true }) and carry no such field,
// and Firestore SILENTLY EXCLUDES documents that are missing the orderBy field.
// The starved rows are precisely the ones most likely to lack it, so that change
// would hide them completely rather than fix anything. __name__ exists on every
// document by definition, and one equality filter plus orderBy(__name__) is
// served by the automatic index, so no composite index has to be deployed for
// the sweep to keep running.
//
// Retirement is deliberately NOT here. Deciding to stop trying to pay someone is
// the owner's call; all this does is guarantee everyone owed money gets looked at.

/** The two statuses reconcileFailedTransfers retries, each with its own window. */
export type ReconcileCursorStatus = 'failed' | 'skipped_no_connected_account'

export const RECONCILE_CURSOR_STATUSES: readonly ReconcileCursorStatus[] = [
  'failed',
  'skipped_no_connected_account',
]

/**
 * Doc id for the cursor, stored in `system_health` beside the liveness stamps —
 * that is already where this codebase keeps small ops state, and the leading
 * underscore is the existing convention for a bookkeeping doc that is NOT a job
 * source (readCronLiveness in lib/alerts.ts skips `_`-prefixed ids, so this must
 * keep its underscore or it will be read as a cron that never runs).
 */
export const RECONCILE_CURSOR_DOC = '_payout_reconcile_cursor'

/** Field on that doc holding the last document id swept for this status. */
export function cursorFieldFor(status: ReconcileCursorStatus): 'failed_after' | 'skipped_after' {
  return status === 'failed' ? 'failed_after' : 'skipped_after'
}

/**
 * Is this value something Firestore will accept as a plain document id?
 *
 * A cursor is bookkeeping and must never be able to take the payout sweep down.
 * `startAfter()` on an orderBy(documentId()) query THROWS on a value containing a
 * slash rather than quietly returning nothing, so a hand-edited or half-written
 * field would turn the whole reconciliation into a 500 every night. Anything we
 * cannot vouch for is treated as "no cursor" — the sweep restarts from the front,
 * which costs one duplicated pass and loses nothing.
 */
function isUsableDocId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.includes('/')) return false
  if (value === '.' || value === '..') return false
  // Firestore caps document ids at 1500 bytes; anything longer never came from a
  // real document id in the first place.
  return value.length <= 1500
}

/**
 * The cursor to resume this status from, read out of the stored doc.
 *
 * Missing doc, missing field, wrong type, empty string, garbage — all mean null,
 * which means "start at the beginning". Never throws: the failure mode of a bad
 * cursor has to be a slower sweep, not a stopped one.
 */
export function readStoredCursor(stored: unknown, status: ReconcileCursorStatus): string | null {
  if (!stored || typeof stored !== 'object') return null
  const value = (stored as Record<string, unknown>)[cursorFieldFor(status)]
  return isUsableDocId(value) ? value : null
}

/**
 * What to store after sweeping one page, and whether more is waiting behind it.
 *
 * A FULL page (>= limit) means the backlog is longer than one run, so the next
 * run must resume after the last id seen — that is the whole point.
 *
 * A SHORT page means we reached the end of this status, so the cursor is cleared
 * and the next run wraps to the beginning. Without the wrap the window would park
 * permanently past the last document and rows that fail LATER — new ones, and
 * ones whose ids sort before the cursor — would never be swept again. That is the
 * same starvation this module exists to fix, just moved to the other end.
 */
export function cursorAfterPage(params: { pageIds: readonly string[]; limit: number }): {
  next: string | null
  truncated: boolean
} {
  const limit = Math.max(1, Math.floor(Number(params.limit) || 0))
  const pageIds = params.pageIds || []
  if (pageIds.length < limit) return { next: null, truncated: false }
  const last = pageIds[pageIds.length - 1]
  // A page we cannot name the end of restarts rather than persisting a value
  // startAfter() would later reject.
  return { next: isUsableDocId(last) ? last : null, truncated: true }
}
