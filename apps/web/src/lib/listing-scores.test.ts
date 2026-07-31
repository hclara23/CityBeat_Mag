import assert from 'node:assert/strict'
import test from 'node:test'
import { localSeoScore, profileCompleteness } from './listing-scores'

test('an empty listing scores 0 on both metrics', () => {
  assert.equal(profileCompleteness({}).score, 0)
  assert.equal(profileCompleteness(null).score, 0)
  assert.equal(localSeoScore(undefined).score, 0)
})

const FULL = {
  name: 'Taco Shop',
  category: 'restaurant',
  address: '123 Main St, El Paso, TX 79901',
  phone: '(915) 555-0100',
  website: 'https://tacos.example',
  description: 'A '.repeat(80) + 'long detailed description of our authentic El Paso tacos.',
  description_es: 'Una descripción larga y detallada de nuestros tacos auténticos de El Paso.',
  image_url: 'https://img.example/cover.jpg',
  gallery_urls: ['a.jpg', 'b.jpg', 'c.jpg'],
  social_links: { facebook: 'https://fb.com/tacos' },
  hours: { Monday: '9-5', Tuesday: '9-5' },
}

test('a fully populated listing scores 100 on both metrics', () => {
  assert.equal(profileCompleteness(FULL).score, 100)
  assert.equal(localSeoScore(FULL).score, 100)
  assert.equal(profileCompleteness(FULL).completed, profileCompleteness(FULL).total)
})

test('profile completeness is proportional and flags the missing items', () => {
  const partial = profileCompleteness({ name: 'X', category: 'shopping' })
  assert.ok(partial.score > 0 && partial.score < 100)
  const missing = partial.items.filter((i) => !i.done).map((i) => i.key)
  assert.ok(missing.includes('address'))
  assert.ok(missing.includes('phone'))
  const done = partial.items.filter((i) => i.done).map((i) => i.key)
  assert.deepEqual(done.sort(), ['category', 'name'])
})

test('a short description does not satisfy the SEO detailed-description item', () => {
  const shortDesc = localSeoScore({ ...FULL, description: 'Tacos.' })
  const item = shortDesc.items.find((i) => i.key === 'description')
  assert.equal(item?.done, false)
  // Profile completeness uses a lower bar (40 chars), so 'Tacos.' also fails there.
  const pc = profileCompleteness({ ...FULL, description: 'Tacos.' })
  assert.equal(pc.items.find((i) => i.key === 'description')?.done, false)
})

test('local SEO rewards a bilingual (Spanish) description', () => {
  const withEs = localSeoScore(FULL)
  const withoutEs = localSeoScore({ ...FULL, description_es: '' })
  assert.ok(withEs.score > withoutEs.score)
  assert.equal(withoutEs.items.find((i) => i.key === 'bilingual')?.done, false)
})

test('every score item ships an EN and ES label', () => {
  for (const build of [profileCompleteness, localSeoScore]) {
    for (const item of build(FULL).items) {
      assert.ok(item.label && item.label_es, `missing label for ${item.key}`)
    }
  }
})
