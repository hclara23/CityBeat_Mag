import test from 'node:test'
import assert from 'node:assert/strict'
import { assessLocality, importedReviewFields, serviceArea } from './quality'

test('exactly eleven cities, their aliases and permitted states pass the review boundary', () => {
  assert.equal(serviceArea.cities.length, 11)
  for (const city of serviceArea.cities) for (const alias of city.aliases) for (const state of city.states) {
    assert.equal(assessLocality({ city: alias, state }).status, 'inside', `${alias}, ${state}`)
    assert.equal(assessLocality({ address: `123 Main St, ${alias}, ${state} 79901` }).status, 'inside')
  }
})
test('outside places, wrong states and substring matches cannot qualify', () => {
  for (const city of ['Odessa', 'Midland', 'Vinton', 'San Elizario', 'Juarez', 'Fort Bliss', 'East El Paso', 'Mesilla']) {
    assert.equal(assessLocality({ city, state: 'TX' }).status, 'outside')
  }
  assert.equal(assessLocality({ city: 'Socorro', state: 'NM' }).status, 'outside')
  assert.equal(assessLocality({ city: 'Las Cruces', state: 'TX' }).status, 'outside')
})
test('missing and conflicting evidence needs review; no defaults or verification claims', () => {
  assert.equal(assessLocality({ address: '123 Main St 79901' }).status, 'review')
  assert.equal(assessLocality({ city: 'El Paso', state: 'TX', address: '123 Main St, Austin, TX 78701' }).status, 'review')
  const fields = importedReviewFields({}, '2026-10-31T00:00:00Z')
  assert.equal(fields.city, null)
  assert.equal(fields.last_verified_at, null)
  assert.equal(fields.is_published, false)
  assert.equal(fields.publication_hold, 'import_quality_review')
})
