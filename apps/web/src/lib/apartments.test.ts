import assert from 'node:assert/strict'
import test from 'node:test'
import { APARTMENT_COMMUNITIES, getApartment, searchApartments, apartmentCompanyId, apartmentCompany, PROPERTY_TYPES } from './apartments'

test('all researched communities have unique detail routes and valid leasing contacts', () => {
  assert.equal(APARTMENT_COMMUNITIES.length, 97)
  assert.equal(new Set(APARTMENT_COMMUNITIES.map(community => community.slug)).size, 97)
  for (const community of APARTMENT_COMMUNITIES) {
    assert.equal(getApartment(community.slug), community)
    assert.match(community.phone, /^[2-9]\d{2}[2-9]\d{6}$/)
    assert.match(community.zip, /^79[89]\d{2}$/)
    assert.ok(['https:', 'http:'].includes(new URL(community.website).protocol))
    assert.ok(apartmentCompany(community))
    assert.ok(community.summary.en && community.summary.es)
    assert.equal(community.highlights.en.length, community.highlights.es.length)
  }
  assert.equal(getApartment('unknown-community'), undefined)
})

test('search supports Spanish accents, address fragments and combined ZIP filters', () => {
  assert.deepEqual(searchApartments('ALZA murchison').map(c => c.slug), ['alza-dwellings'])
  assert.equal(searchApartments('recámaras').length, searchApartments('recamaras').length)
  assert.ok(searchApartments('recamaras').length > 0)
  assert.ok(searchApartments('', '79935').some(c => c.slug === 'ridgemar'))
  assert.ok(searchApartments('', '79935').every(c => c.zip === '79935'))
  assert.equal(searchApartments('ALZA', '79935').length, 0)
  assert.equal(searchApartments('no such community').length, 0)
})

test('apartment filtering does not misclassify the single-family rental community', () => {
  assert.equal(searchApartments('', '', 'apartments').length, 96)
  assert.deepEqual(searchApartments('', '', 'rental-homes').map(c => c.slug), ['terralane-at-campo-del-sol'])
  assert.equal(searchApartments('TerraLane', '', 'apartments').length, 0)
})

test('published company rosters remain separate and all rental categories have bilingual labels', () => {
  const counts = Object.fromEntries(['rpm-living','m7-elp','integrity-asset-management','case-associates','haggerty-company'].map(id => [id, APARTMENT_COMMUNITIES.filter(p => apartmentCompanyId(p) === id).length]))
  assert.deepEqual(counts, {'rpm-living':10,'m7-elp':19,'integrity-asset-management':59,'case-associates':9,'haggerty-company':0})
  assert.equal(Object.keys(PROPERTY_TYPES).length, 8)
  for (const label of Object.values(PROPERTY_TYPES)) assert.ok(label.en && label.es)
  assert.equal(getApartment('ashton-parke')?.address, '5815 Timberwolf Dr')
  assert.equal(getApartment('la-hacienda-at-villa-victoria')?.city, 'San Elizario')
  assert.equal(searchApartments('M7').length,19)
})
