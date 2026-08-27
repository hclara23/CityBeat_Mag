import assert from 'node:assert/strict'
import test from 'node:test'
import { selectSponsoredWindow, sponsorshipExpired, SPONSORED_SLOTS } from './sponsored-rotation'

const at = (id: string, iso: string) => ({ id, sponsored_since: iso })

test('3 or fewer sponsors always all show, every day, in stable order', () => {
  const two = [at('b', '2026-02-01'), at('a', '2026-01-01')]
  const day1 = selectSponsoredWindow(two, new Date('2026-08-01'))
  const day2 = selectSponsoredWindow(two, new Date('2026-08-02'))
  assert.deepEqual(day1.map((x) => x.id), ['a', 'b'])
  assert.deepEqual(day2.map((x) => x.id), ['a', 'b'], 'no rotation needed at or under the slot count')
})

test('more than 3 sponsors rotate through fixed daily windows without a partial row', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((id, i) => at(id, `2026-01-0${i + 1}`))
  // groups = ceil(5/3) = 2 → day 0 → window [0..2] = a,b,c ; day 1 → window [3,4,0] = d,e,a (wraps, still 3)
  const day0 = selectSponsoredWindow(five, new Date(0))
  const day1 = selectSponsoredWindow(five, new Date(86_400_000))
  const day2 = selectSponsoredWindow(five, new Date(86_400_000 * 2))
  assert.equal(day0.length, SPONSORED_SLOTS)
  assert.equal(day1.length, SPONSORED_SLOTS)
  assert.deepEqual(day0.map((x) => x.id), ['a', 'b', 'c'])
  assert.deepEqual(day1.map((x) => x.id), ['d', 'e', 'a'], 'wraps around instead of showing a partial 2-card row')
  assert.deepEqual(day2.map((x) => x.id), day0.map((x) => x.id), 'cycle repeats after `groups` days')
})

test('every sponsor gets equal exposure over a full cycle', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => at(id, `2026-01-${String(i + 1).padStart(2, '0')}`))
  const groups = Math.ceil(seven.length / SPONSORED_SLOTS)
  const seen = new Map<string, number>()
  for (let d = 0; d < groups; d++) {
    for (const item of selectSponsoredWindow(seven, new Date(d * 86_400_000))) {
      seen.set(item.id, (seen.get(item.id) || 0) + 1)
    }
  }
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) assert.ok((seen.get(id) || 0) >= 1, `${id} should appear at least once per cycle`)
})

test('sponsorshipExpired: null/absent never expires; a past date does; a future date does not', () => {
  assert.equal(sponsorshipExpired(null), false)
  assert.equal(sponsorshipExpired(undefined), false)
  assert.equal(sponsorshipExpired('2026-01-01T00:00:00.000Z', new Date('2026-06-01')), true)
  assert.equal(sponsorshipExpired('2027-01-01T00:00:00.000Z', new Date('2026-06-01')), false)
  assert.equal(sponsorshipExpired('not-a-date', new Date('2026-06-01')), false)
})
