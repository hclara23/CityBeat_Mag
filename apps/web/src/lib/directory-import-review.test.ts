import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewImportEdit, ImportReviewError } from './directory-import-review'
const current = { name: 'Example Shop', address: '123 Main St, El Paso, TX 79901', category: 'Retail', publication_hold: 'import_quality_review', is_published: false, source_url: 'https://example.org/source' }
const body = { approve_import_review: true, duplicate_review_confirmed: true, review_source_url: 'https://example.org/source', review_notes: 'Checked full address, operating status and duplicate locations against source.' }
test('quick publish cannot bypass import review or clear other holds', () => {
  assert.throws(() => reviewImportEdit(current, { is_published: true }, {}, 'admin', 'now'), ImportReviewError)
  assert.throws(() => reviewImportEdit({ ...current, publication_hold: 'privacy' }, {}, body, 'admin', 'now'), ImportReviewError)
})
test('approval requires source, explicit review, allowed location and complete evidence', () => {
  for (const patch of [{ review_source_url: 'javascript:alert(1)' }, { duplicate_review_confirmed: false }, { review_notes: '' }]) {
    assert.throws(() => reviewImportEdit(current, {}, { ...body, ...patch }, 'admin', 'now'), ImportReviewError)
  }
  assert.throws(() => reviewImportEdit(current, { address: '1 St, Odessa, TX 79761' }, body, 'admin', 'now'), ImportReviewError)
  assert.throws(() => reviewImportEdit({ ...current, source_url: 'https://maps.google.com/abc' }, {}, body, 'admin', 'now'), ImportReviewError)
})
test('approval records who verified and when without changing billing, owner or publication', () => {
  const result = reviewImportEdit({ ...current, tier: 'premium', owner_id: 'owner', stripe_subscription_id: 'sub' }, {}, body, 'editor', '2026-10-31')
  assert.equal(result.publication_hold, null)
  assert.equal(result.verified_by, 'editor')
  assert.equal(result.last_verified_at, '2026-10-31')
  for (const field of ['tier', 'owner_id', 'stripe_subscription_id', 'is_published']) assert.equal(Object.prototype.hasOwnProperty.call(result, field), false)
})
