import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastModified } from './public-sitemap'

// ---------------------------------------------------------------------------
// Production was publishing 100 impossible lastmod dates — every Ticketmaster
// event URL carried its event's START DATE as its last-modified date, the newest
// 2026-12-11. That is 28% of the sitemap's 355 lastmod values. A future lastmod
// is the standard trigger for a crawler distrusting the field across the WHOLE
// file, which would cost the honest story dates the trust they were added to earn.
// ---------------------------------------------------------------------------

const NOW = new Date('2026-10-27T12:00:00.000Z')

test('a future date is never published as a last-modified time', () => {
  // The real newest offender from https://citybeatmag.co/sitemap.xml.
  assert.equal(lastModified(['2026-12-11T02:30:00Z'], NOW), undefined)
})

test('it falls through to the first candidate that has actually happened', () => {
  const got = lastModified(['2026-12-11T02:30:00Z', '2026-10-20T09:00:00Z'], NOW)
  assert.equal(got?.toISOString(), '2026-10-20T09:00:00.000Z')
})

test('omitting lastmod beats inventing one', () => {
  // No usable candidate must yield undefined, not `now` — stamping every URL
  // with the current time is the original sin this module's comment describes.
  assert.equal(lastModified([], NOW), undefined)
  assert.equal(lastModified([null, undefined, '', 'not a date'], NOW), undefined)
})

test('a Firestore Timestamp is accepted, and still bounded by now', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) })
  assert.equal(lastModified([ts('2026-10-01T00:00:00Z')], NOW)?.toISOString(), '2026-10-01T00:00:00.000Z')
  assert.equal(lastModified([ts('2026-12-01T00:00:00Z')], NOW), undefined)
})

test('a date exactly now is allowed', () => {
  assert.equal(lastModified([NOW.toISOString()], NOW)?.toISOString(), NOW.toISOString())
})
