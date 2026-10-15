import assert from 'node:assert/strict'
import test from 'node:test'
import { auditDirectoryPublication } from './directory-publication'

const valid = {
  id: 'candidate',
  is_published: false,
  name: 'Border Air Experts',
  category: 'Home Services',
  address: '100 Mesa St, El Paso, TX',
}

test('merged siblings never become bulk-publication candidates', () => {
  const result = auditDirectoryPublication([
    { ...valid, id: 'canonical', is_published: true },
    { ...valid, id: 'sibling', merged_into: 'canonical' },
  ])
  assert.equal(result.eligible, 0)
  assert.equal(result.blocked.merged_duplicate, 1)
})

test('restricted Google-derived records are refused even when otherwise complete', () => {
  const result = auditDirectoryPublication([
    { ...valid, google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4' },
  ])
  assert.equal(result.eligible, 0)
  assert.equal(result.blocked.restricted_provenance, 1)
})

test('a complete open-data candidate is eligible', () => {
  const result = auditDirectoryPublication([{ ...valid, source_url: 'https://data.texas.gov/resource/example' }])
  assert.deepEqual(result.eligibleIds, ['candidate'])
})

test('thin, unknown-category and closed records are blocked', () => {
  const result = auditDirectoryPublication([
    { ...valid, id: 'thin', address: null },
    { ...valid, id: 'category', category: 'Mystery' },
    { ...valid, id: 'closed', business_status: 'Permanently closed' },
  ])
  assert.equal(result.blocked.no_contact_path, 1)
  assert.equal(result.blocked.invalid_category, 1)
  assert.equal(result.blocked.closed_business, 1)
})

test('identity collisions with a published listing or earlier candidate are blocked', () => {
  const result = auditDirectoryPublication([
    { ...valid, id: 'live', is_published: true },
    { ...valid, id: 'same-as-live' },
    { ...valid, id: 'fresh', name: 'Fresh HVAC', phone: '915-555-0101', address: null },
    { ...valid, id: 'same-fresh', name: 'Fresh HVAC', phone: '(915) 555-0101', address: null },
  ])
  assert.deepEqual(result.eligibleIds, ['fresh'])
  assert.equal(result.blocked.duplicate_identity, 2)
})
