import assert from 'node:assert/strict'
import test from 'node:test'
import { selectSponsoredWindow, sponsorshipExpired, SPONSORED_SLOTS } from './sponsored-rotation'

const id = (v: string) => ({ id: v })

/** Deterministic fake PRNG for reproducible shuffle assertions. */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

test('3 or fewer candidates: everyone shows (order may vary)', () => {
  const two = [id('a'), id('b')]
  const result = selectSponsoredWindow(two, SPONSORED_SLOTS, seededRandom(1))
  assert.equal(result.length, 2)
  assert.deepEqual(new Set(result.map((x) => x.id)), new Set(['a', 'b']))
})

test('more than 3 candidates: exactly SPONSORED_SLOTS are chosen, no duplicates', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id)
  const result = selectSponsoredWindow(seven, SPONSORED_SLOTS, seededRandom(42))
  assert.equal(result.length, SPONSORED_SLOTS)
  assert.equal(new Set(result.map((x) => x.id)).size, SPONSORED_SLOTS, 'no repeats within one selection')
  for (const r of result) assert.ok(seven.some((c) => c.id === r.id), 'every pick came from the real candidate pool')
})

test('different random sources produce different windows over many draws (true rotation, not a fixed order)', () => {
  const ten = Array.from({ length: 10 }, (_, i) => id(`c${i}`))
  const seen = new Set<string>()
  for (let seed = 0; seed < 30; seed++) {
    for (const item of selectSponsoredWindow(ten, SPONSORED_SLOTS, seededRandom(seed * 7919 + 1))) seen.add(item.id)
  }
  assert.ok(seen.size > SPONSORED_SLOTS, 'across many views, more than just one fixed set of 3 ever appears')
})

test('a default call (real Math.random) still returns a valid-sized, deduped window', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map(id)
  const result = selectSponsoredWindow(five)
  assert.equal(result.length, SPONSORED_SLOTS)
  assert.equal(new Set(result.map((x) => x.id)).size, SPONSORED_SLOTS)
})

test('sponsorshipExpired: null/absent never expires; a past date does; a future date does not', () => {
  assert.equal(sponsorshipExpired(null), false)
  assert.equal(sponsorshipExpired(undefined), false)
  assert.equal(sponsorshipExpired('2026-01-01T00:00:00.000Z', new Date('2026-06-01')), true)
  assert.equal(sponsorshipExpired('2027-01-01T00:00:00.000Z', new Date('2026-06-01')), false)
  assert.equal(sponsorshipExpired('not-a-date', new Date('2026-06-01')), false)
})
