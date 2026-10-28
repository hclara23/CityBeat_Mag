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

test('a listing under a publication hold is never a bulk-publication candidate', () => {
  // The FMCSA census includes sole proprietors filed under their own name. Those
  // were unpublished on purpose, but such a row has a name, a category and a
  // phone, so it satisfies every OTHER check and "publish all" would have
  // restored it. The hold must win even when the row is otherwise complete.
  const held = {
    ...valid,
    id: 'held',
    phone: '9155550100',
    publication_hold: 'fmcsa_individual',
  }
  const result = auditDirectoryPublication([held, { ...valid, id: 'ordinary', name: 'Mesa Air Pros' }])
  assert.equal(result.blocked.publication_hold, 1)
  assert.deepEqual(result.eligibleIds, ['ordinary'], 'only the row without a hold is eligible')
})

test('an empty or missing hold does not block', () => {
  for (const publication_hold of [undefined, null, '']) {
    const result = auditDirectoryPublication([{ ...valid, publication_hold }])
    assert.equal(result.eligible, 1)
    assert.equal(result.blocked.publication_hold, 0)
  }
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
