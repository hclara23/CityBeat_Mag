import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RECONCILE_CURSOR_DOC,
  RECONCILE_CURSOR_STATUSES,
  cursorAfterPage,
  cursorFieldFor,
  readStoredCursor,
} from './payout-reconcile-cursor'

test('a full page moves the window past its last row instead of re-reading it forever', () => {
  // The starvation bug: no cursor means the same first `limit` ids every night,
  // so anything behind a pile of unpayable rows is never examined again.
  const page = ['tr_a', 'tr_b', 'tr_c']
  assert.deepEqual(cursorAfterPage({ pageIds: page, limit: 3 }), { next: 'tr_c', truncated: true })
  // Resuming from that cursor is what the next run must do.
  assert.equal(readStoredCursor({ failed_after: 'tr_c' }, 'failed'), 'tr_c')
})

test('a short page wraps to the beginning instead of parking past the last row', () => {
  // Clearing the cursor is not cosmetic: a window left pinned at the end would
  // never see a row that fails LATER, or one whose id sorts before it — the same
  // starvation, moved to the other end of the collection.
  assert.deepEqual(cursorAfterPage({ pageIds: ['tr_a'], limit: 50 }), { next: null, truncated: false })
  assert.deepEqual(cursorAfterPage({ pageIds: [], limit: 50 }), { next: null, truncated: false })
})

test('a truncated page is reported so a dry run tells an operator a backlog exists', () => {
  assert.equal(cursorAfterPage({ pageIds: ['a', 'b'], limit: 2 }).truncated, true)
  assert.equal(cursorAfterPage({ pageIds: ['a'], limit: 2 }).truncated, false)
  // A nonsense limit must not make an empty sweep look like a pile.
  assert.equal(cursorAfterPage({ pageIds: [], limit: 0 }).truncated, false)
  assert.equal(cursorAfterPage({ pageIds: [], limit: Number.NaN }).truncated, false)
})

test('a missing or malformed stored cursor restarts the sweep instead of throwing', () => {
  // Every one of these has to mean "start at the beginning". A cursor is
  // bookkeeping; it must never be able to stop commission from being paid.
  for (const stored of [undefined, null, 'not-an-object', 42, {}, { failed_after: null }, { failed_after: '' }, { failed_after: 7 }]) {
    assert.equal(readStoredCursor(stored, 'failed'), null)
  }
})

test('a cursor Firestore would reject as a document id is discarded, not handed to startAfter', () => {
  // startAfter() on an orderBy(documentId()) query THROWS on a slash rather than
  // returning nothing, so persisting one would 500 the job every night.
  assert.equal(readStoredCursor({ failed_after: 'transfers/tr_a' }, 'failed'), null)
  assert.equal(readStoredCursor({ failed_after: '.' }, 'failed'), null)
  assert.equal(readStoredCursor({ failed_after: '..' }, 'failed'), null)
  assert.equal(readStoredCursor({ failed_after: 'x'.repeat(1501) }, 'failed'), null)
  // And the same value is never written out at the end of a page either.
  assert.deepEqual(cursorAfterPage({ pageIds: ['ok', 'transfers/tr_a'], limit: 2 }), {
    next: null,
    truncated: true,
  })
})

test('the two statuses keep independent cursors so a stuck pile cannot move the other window', () => {
  // `skipped_no_connected_account` is the status that piles up (a payee who never
  // connects a bank). Sharing one cursor with `failed` would let that pile drag
  // the recoverable rows' window along with it.
  const stored = { failed_after: 'tr_failed_9', skipped_after: 'tr_skipped_2' }
  assert.equal(readStoredCursor(stored, 'failed'), 'tr_failed_9')
  assert.equal(readStoredCursor(stored, 'skipped_no_connected_account'), 'tr_skipped_2')
  assert.notEqual(cursorFieldFor('failed'), cursorFieldFor('skipped_no_connected_account'))
  assert.deepEqual([...RECONCILE_CURSOR_STATUSES], ['failed', 'skipped_no_connected_account'])
})

test('the cursor doc stays underscore-prefixed so liveness never reads it as a dead cron', () => {
  // readCronLiveness in lib/alerts.ts skips `_`-prefixed system_health docs. Drop
  // the underscore and the heartbeat starts paging about a job that does not exist.
  assert.ok(RECONCILE_CURSOR_DOC.startsWith('_'))
})
