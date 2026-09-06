import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSalesDirectoryListingRecord } from './sales-directory'

test('a rep-sold listing carries the rating field the directory sorts on', () => {
  // The regression this pins: the record shipped without a `rating` key at all,
  // and Firestore drops key-less documents from an orderBy. The /directory
  // landing view sorts each tier by rating, so a business that had just paid a
  // rep at their counter did not appear on it — the listing existed, the tier
  // was right, the page simply never returned it. Present-and-null is what
  // keeps the row in the result set, so `in` is the assertion that matters,
  // not the value; a placeholder NUMBER would instead rank an unreviewed
  // listing above genuinely reviewed businesses.
  const record = buildSalesDirectoryListingRecord({
    businessName: 'Mesa Studio',
    category: 'Design',
    contactEmail: 'owner@example.com',
    locale: 'en',
    sellerUserId: 'rep_123',
    productId: 'directory_premium_monthly',
    now: new Date('2026-09-05T12:00:00.000Z'),
  })

  assert.equal('rating' in record, true)
  assert.equal(record.rating, null)
  assert.equal('user_ratings_total' in record, true)
  assert.equal(record.user_ratings_total, null)
})
