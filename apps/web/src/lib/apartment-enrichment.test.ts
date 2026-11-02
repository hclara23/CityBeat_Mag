import assert from 'node:assert/strict'
import test from 'node:test'
import { APARTMENT_RESEARCH } from './apartment-enrichment'
import { getApartment, apartmentCompanyId } from './apartments'
import { apartmentSeed, approvedApartment } from './apartment-listing'

test('research covers the 29 local RPM/M7 entries with bilingual source-backed records', () => {
  assert.equal(Object.keys(APARTMENT_RESEARCH).length, 29)
  for (const [slug, research] of Object.entries(APARTMENT_RESEARCH)) {
    const property = getApartment(slug)!
    assert.ok(property)
    assert.ok(['rpm-living', 'm7-elp'].includes(apartmentCompanyId(property)))
    assert.equal(research.checkedAt, '2026-11-02')
    assert.ok(research.summary.en && research.summary.es)
    assert.equal(research.highlights.en.length, research.highlights.es.length)
    assert.ok(research.sources.length)
    const urls = [...research.sources, research.galleryUrl, research.floorplansUrl, ...research.photos.flatMap(p => [p.url, p.sourceUrl])].filter(Boolean)
    for (const url of urls) assert.equal(new URL(url!).protocol, 'https:')
    for (const photo of research.photos) assert.ok(photo.caption.en && photo.caption.es)
  }
  assert.equal(Object.values(APARTMENT_RESEARCH).reduce((n, p) => n + p.photos.length, 0), 69)
  assert.equal(APARTMENT_RESEARCH['lee-place'].photos.length, 0)
  assert.equal(APARTMENT_RESEARCH['amigos-del-sol'].photos.length, 0)
})

test('claim seeding carries researched content without granting ownership or changing claim contacts', () => {
  const property = getApartment('alza-dwellings')!
  const seed = apartmentSeed(property)
  assert.equal(seed.phone, '+19152655427')
  assert.equal(seed.owner_id, null)
  assert.equal(seed.claim_status, 'unclaimed')
  assert.equal(seed.description, property.summary.en)
  assert.deepEqual(seed.gallery_urls, property.research!.photos.map(p => p.url))
})

test('approved manager edits override research while pending claims cannot change photos', () => {
  const property = getApartment('alza-dwellings')!
  const data = { claim_status: 'approved', owner_id: 'owner', description: 'Manager-approved description', gallery_urls: ['https://example.com/photo.jpg', 'javascript:alert(1)'] }
  const edited = approvedApartment(property, data)
  assert.equal(edited.summary.en, data.description)
  assert.deepEqual(edited.research!.photos.map(p => p.url), ['https://example.com/photo.jpg'])
  assert.deepEqual(approvedApartment(property, { ...data, gallery_urls: [] }).research!.photos, [])
  assert.equal(approvedApartment(property, { ...data, claim_status: 'pending' }), property)
})
