import test from 'node:test'
import assert from 'node:assert/strict'
import { stripInternalListingFields } from './listing-fields'

test('approved imported listings never expose staff notes or identities publicly', () => {
  const publicRow = stripInternalListingFields<Record<string, unknown>>({ name: 'Example', is_published: true,
    verification_notes: 'Private review evidence', verified_by: 'private-staff-id',
    original_source_url: 'https://example.org/private-review', publication_hold: null,
    quality_review_reasons: ['private reason'], last_verified_at: '2026-10-31', source_url: 'https://example.org' })
  for (const field of ['verification_notes', 'verified_by', 'original_source_url', 'publication_hold', 'quality_review_reasons']) {
    assert.equal(field in publicRow, false)
  }
  assert.equal(publicRow.name, 'Example')
  assert.equal(publicRow.last_verified_at, '2026-10-31')
})
