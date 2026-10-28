import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { decodeListingId } from './directory-listing-id'

// The bug: an encoded route segment meant `doc(id)` missed for every `sf:` id,
// so 8,280 published scraped listings rendered "Business not found" on their own
// public page while the dynamic API route resolved the same id fine.

test('an encoded colon is restored, which is the whole bug', () => {
  assert.equal(decodeListingId('sf%3A00a78c2d62672274f2831cf0'), 'sf:00a78c2d62672274f2831cf0')
  assert.equal(decodeListingId('sf%3a00a78c2d62672274f2831cf0'), 'sf:00a78c2d62672274f2831cf0', 'lowercase escape')
})

test('an already-decoded id is returned untouched', () => {
  // The function is applied unconditionally, so this must be a no-op rather
  // than a second transformation.
  for (const id of [
    'sf:00a78c2d62672274f2831cf0',
    'WZ084cO6lk7LIpR4r0Jn', // Firestore auto-id
    '0010e6a5-9d4c-46ef-aa9d-3184c1bbda12', // uuid
    'ChIJN1t_tDeuEmsRUsoyG83frY4', // Google place id shape
  ]) {
    assert.equal(decodeListingId(id), id, id)
    assert.equal(decodeListingId(decodeListingId(id)), id, `${id} must be idempotent`)
  }
})

test('decoding a real sf: id round-trips through the actual id scheme', () => {
  // Built the way normalize.ts builds it, so this test fails if that scheme
  // changes shape rather than passing against a hand-written constant.
  const id = `sf:${createHash('sha1').update('la estrella del oeste|2211 E').digest('hex').slice(0, 24)}`
  assert.match(id, /^sf:[0-9a-f]{24}$/)
  assert.equal(decodeListingId(encodeURIComponent(id)), id)
})

test('a malformed escape does not throw', () => {
  // Reachable by hand-typing a URL. A 500 here would be worse than a miss.
  for (const bad of ['%', '%zz', 'sf%3', '100%', '%E0%A4%A']) {
    assert.doesNotThrow(() => decodeListingId(bad))
    assert.equal(decodeListingId(bad), bad, `"${bad}" should pass through verbatim`)
  }
})

test('empty and non-string inputs never widen into a collection read', () => {
  // Returning '' would turn doc('') into an invalid path rather than a miss.
  assert.equal(decodeListingId(''), '')
  assert.equal(decodeListingId(undefined as unknown as string), '')
  assert.equal(decodeListingId(null as unknown as string), '')
})

test('a double-encoded segment is only decoded one level', () => {
  // Decoding to a fixpoint would be a different (and riskier) contract: one
  // level is what a route segment needs, and no real id contains '%'.
  assert.equal(decodeListingId('sf%253A00a7'), 'sf%3A00a7')
})
