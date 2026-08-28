import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LOCAL_CATEGORIES,
  LOCAL_CITIES,
  findCategory,
  findCity,
  inCity,
  rank,
} from './local-seo'

test('category + city slugs are unique and well-formed (no duplicate URLs)', () => {
  const catSlugs = LOCAL_CATEGORIES.map((c) => c.slug)
  assert.equal(new Set(catSlugs).size, catSlugs.length, 'duplicate category slug')
  const citySlugs = LOCAL_CITIES.map((c) => c.slug)
  assert.equal(new Set(citySlugs).size, citySlugs.length, 'duplicate city slug')
  for (const c of LOCAL_CATEGORIES) {
    assert.ok(/^[a-z][a-z0-9-]*$/.test(c.slug), `bad slug ${c.slug}`)
    assert.ok(c.value && c.plural && c.label, `${c.slug}: missing value/plural/label`)
  }
  for (const c of LOCAL_CITIES) {
    assert.ok(c.aliases.length > 0, `${c.slug}: no aliases`)
  }
})

test('findCategory / findCity resolve known slugs and reject the rest', () => {
  assert.equal(findCategory('restaurants')?.value, 'Restaurant')
  assert.equal(findCity('el-paso')?.name, 'El Paso')
  assert.equal(findCategory('not-a-cat'), null)
  assert.equal(findCity(undefined), null)
})

test('inCity matches by address alias, case-insensitively, incl. Juárez variants', () => {
  const juarez = findCity('ciudad-juarez')!
  assert.equal(inCity({ address: '123 Av. Juarez, Ciudad Juárez' }, juarez), true)
  assert.equal(inCity({ address: 'somewhere in JUAREZ downtown' }, juarez), true)
  const elPaso = findCity('el-paso')!
  assert.equal(inCity({ address: '500 N Mesa St, El Paso, TX' }, elPaso), true)
  // A Las Cruces address must NOT match El Paso.
  assert.equal(inCity({ address: '100 Main St, Las Cruces, NM' }, elPaso), false)
  // Multi-location brands: the city can live in the locations blob.
  assert.equal(inCity({ address: '', locations: [{ address: '1 A St, Socorro' }] }, findCity('socorro')!), true)
})

test('rank orders sponsored → tier → rating → reviews → name', () => {
  const sponsored = { is_sponsored: true, tier: 'basic', name: 'Z' }
  const featured = { is_sponsored: false, tier: 'featured', name: 'A' }
  // Sponsored wins regardless of tier.
  assert.ok(rank(sponsored, featured) < 0)

  const premium = { tier: 'premium', rating: 3, name: 'B' }
  const basic = { tier: 'basic', rating: 5, name: 'A' }
  // Tier beats rating.
  assert.ok(rank(premium, basic) < 0)

  const hi = { tier: 'premium', rating: 4.8, user_ratings_total: 10, name: 'B' }
  const lo = { tier: 'premium', rating: 4.2, user_ratings_total: 99, name: 'A' }
  // Same tier → higher rating wins over more reviews.
  assert.ok(rank(hi, lo) < 0)

  const r1 = { tier: 'premium', rating: 4.5, user_ratings_total: 20, name: 'Bravo' }
  const r2 = { tier: 'premium', rating: 4.5, user_ratings_total: 20, name: 'Alpha' }
  // Full tie → alphabetical by name.
  assert.ok(rank(r1, r2) > 0)

  // A real sort is stable and puts the sponsored/featured first.
  const sorted = [basic, sponsored, featured, premium].slice().sort(rank)
  assert.equal(sorted[0], sponsored)
})
