import assert from 'node:assert/strict'
import test from 'node:test'
import { APARTMENT_COMMUNITIES, getApartment, searchApartments } from './apartments'

test('all ten source-verified communities have unique detail routes and valid leasing contacts', () => {
  assert.equal(APARTMENT_COMMUNITIES.length, 10)
  assert.equal(new Set(APARTMENT_COMMUNITIES.map(community => community.slug)).size, 10)
  for (const community of APARTMENT_COMMUNITIES) {
    assert.equal(getApartment(community.slug), community)
    assert.match(community.phone, /^915\d{7}$/)
    assert.match(community.zip, /^799\d{2}$/)
    assert.equal(new URL(community.website).protocol, 'https:')
    assert.ok(community.summary.en && community.summary.es)
    assert.equal(community.highlights.en.length, community.highlights.es.length)
  }
  assert.equal(getApartment('unknown-community'), undefined)
})

test('search supports Spanish accents, address fragments and combined ZIP filters', () => {
  assert.deepEqual(searchApartments('ALZA murchison').map(c => c.slug), ['alza-dwellings'])
  assert.equal(searchApartments('recámaras').length, searchApartments('recamaras').length)
  assert.ok(searchApartments('recamaras').length > 0)
  assert.deepEqual(searchApartments('', '79935').map(c => c.slug), ['ridgemar', 'lake-fairway'])
  assert.equal(searchApartments('ALZA', '79935').length, 0)
  assert.equal(searchApartments('no such community').length, 0)
})

test('apartment filtering does not misclassify the single-family rental community', () => {
  assert.equal(searchApartments('', '', 'apartments').length, 9)
  assert.deepEqual(searchApartments('', '', 'rental-homes').map(c => c.slug), ['terralane-at-campo-del-sol'])
  assert.equal(searchApartments('TerraLane', '', 'apartments').length, 0)
})
