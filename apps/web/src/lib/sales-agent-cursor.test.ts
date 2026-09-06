import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeListingCursor,
  encodeListingCursor,
  hasDeliverableAddressLine,
} from './sales-agent'

test('the cursor carries the document id, not just the created_at value', () => {
  // The regression this pins: startAfter(<created_at>) positions after EVERY
  // document sharing that timestamp. ScrapeFlow stamps one timestamp on a whole
  // insert batch, so a page that ended mid-batch skipped the rest of the batch
  // permanently. The document id is the half of the sort key that makes the
  // cursor point at exactly one row.
  const raw = encodeListingCursor('2026-08-22T00:00:00.000Z', 'sf:abc123')
  assert.ok(raw)
  assert.deepEqual(decodeListingCursor(raw), {
    kind: 'string',
    value: '2026-08-22T00:00:00.000Z',
    id: 'sf:abc123',
  })
})

test('a Timestamp created_at survives the round trip as a Timestamp', () => {
  // directory_listings.created_at is an ISO string from the scraper sink and a
  // server Timestamp from the admin create path. Firestore orders the two types
  // apart, so a Timestamp re-sent as a string would resume in the wrong type
  // bucket and skip everything again.
  const raw = encodeListingCursor({ seconds: 1755820800, nanoseconds: 123000000 }, 'osm:99')
  assert.deepEqual(decodeListingCursor(raw), {
    kind: 'timestamp',
    seconds: 1755820800,
    nanoseconds: 123000000,
    id: 'osm:99',
  })
})

test('an unusable created_at persists no cursor rather than a partial one', () => {
  // Persisting half a sort key is what caused the skipping in the first place;
  // a null cursor just restarts the walk, which only costs re-reads.
  assert.equal(encodeListingCursor(undefined, 'x1'), null)
  assert.equal(encodeListingCursor(null, 'x1'), null)
  assert.equal(encodeListingCursor('', 'x1'), null)
  assert.equal(encodeListingCursor({ seconds: 'nope' }, 'x1'), null)
  assert.equal(encodeListingCursor('2026-08-22T00:00:00.000Z', ''), null)
})

test('a legacy bare-timestamp cursor is discarded, not replayed', () => {
  // Cursors written before this fix are bare created_at strings — precisely the
  // poisoned values that skipped the tie group. Decoding them to null restarts
  // the walk; already-contacted listings are skipped by the sales_outreach guard.
  assert.equal(decodeListingCursor('2026-08-22T00:00:00.000Z'), null)
  assert.equal(decodeListingCursor(null), null)
  assert.equal(decodeListingCursor(''), null)
  assert.equal(decodeListingCursor('{"kind":"string","value":"t"}'), null) // no id
  assert.equal(decodeListingCursor('{"kind":"string","id":"a"}'), null) // no value
  assert.equal(decodeListingCursor('{"kind":"other","value":"t","id":"a"}'), null)
  assert.equal(decodeListingCursor('"just-a-json-string"'), null)
})

test('a city and a state is not a postal address', () => {
  // CAN-SPAM 7704(a)(5) wants a place mail can be delivered. The shipped
  // fallback names a city and a state and nothing mailable, so it must not pass.
  assert.equal(hasDeliverableAddressLine('CityBeat Media Group, El Paso, TX, USA'), false)
  assert.equal(hasDeliverableAddressLine('CityBeat Mag, El Paso, TX 79901'), false)
  assert.equal(hasDeliverableAddressLine(''), false)
  assert.equal(hasDeliverableAddressLine('   '), false)
})

test('a street line or a PO box counts as deliverable', () => {
  assert.equal(
    hasDeliverableAddressLine('CityBeat Media Group, 500 N Oregon St Ste 200, El Paso, TX 79901'),
    true
  )
  assert.equal(hasDeliverableAddressLine('123 Main St, El Paso, TX 79901'), true)
  assert.equal(hasDeliverableAddressLine('CityBeat, PO Box 1234, El Paso, TX 79901'), true)
  assert.equal(hasDeliverableAddressLine('CityBeat, P.O. Box 1234, El Paso, TX'), true)
  assert.equal(hasDeliverableAddressLine('CityBeat, PMB 88, 4000 Example Blvd, El Paso, TX'), true)
})
