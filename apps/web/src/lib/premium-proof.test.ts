import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_ACTIONS_TO_PUBLISH,
  countActions,
  medianIndex,
  pickRepresentativeProof,
  proofTiles,
  type ProofCandidate,
} from './premium-proof'

// What these pin: /premium argues that Premium gives an owner transparent, real
// measurement, and illustrated it with numbers that were invented. Replacing
// them with real ones is only an improvement if the selection cannot quietly
// become a cherry-picked best case, and if a thin month renders nothing rather
// than something unconvincing.

const candidate = (listingId: string, over: Partial<ProofCandidate> = {}): ProofCandidate => ({
  listingId,
  view: 0,
  click_website: 0,
  click_directions: 0,
  click_phone: 0,
  click_action: 0,
  lead: 0,
  ...over,
})

test('views are not counted as customer actions', () => {
  // Views are the cheapest number any directory can quote, and the one a
  // sceptical owner discounts first. Folding them into the headline would
  // inflate it with exactly the metric the page should not lean on.
  const c = candidate('a', { view: 500, click_website: 2 })
  assert.equal(countActions(c), 2)
})

test('an action is anything a customer did, across every channel', () => {
  const c = candidate('a', {
    click_website: 1,
    click_directions: 2,
    click_phone: 3,
    click_action: 4,
    lead: 5,
  })
  assert.equal(countActions(c), 15)
})

test('negative counters cannot reduce the total', () => {
  // A corrupted or decremented counter must not be able to make the published
  // figure smaller than the actions that really happened.
  const c = candidate('a', { click_website: 5, click_phone: -99 })
  assert.equal(countActions(c), 5)
})

// --- The honesty rules ---------------------------------------------------------

test('the representative is the median, never the best', () => {
  // The single most important rule here. Publishing the best performer is the
  // same dishonesty as inventing a number, and it is the default a careless
  // implementation reaches for.
  const candidates = [
    candidate('low', { click_website: 6 }), // 6
    candidate('mid', { click_website: 20 }), // 20
    candidate('high', { click_website: 900 }), // 900
  ]
  const proof = pickRepresentativeProof(candidates)
  assert.ok(proof)
  assert.equal(proof.actions, 20, 'picked the middle performer, not the 900')
})

test('an even sample takes the LOWER middle, so the figure is never flattered', () => {
  const candidates = [
    candidate('a', { click_website: 6 }),
    candidate('b', { click_website: 10 }),
    candidate('c', { click_website: 40 }),
    candidate('d', { click_website: 80 }),
  ]
  const proof = pickRepresentativeProof(candidates)
  assert.equal(proof?.actions, 10, 'lower of the two middle values')
})

test('medianIndex never reaches past the end or returns the top element', () => {
  assert.equal(medianIndex(0), -1)
  assert.equal(medianIndex(1), 0)
  assert.equal(medianIndex(2), 0)
  assert.equal(medianIndex(3), 1)
  assert.equal(medianIndex(4), 1)
  assert.equal(medianIndex(5), 2)
  for (let n = 1; n < 50; n++) {
    assert.ok(medianIndex(n) < n, `index must stay in range for ${n}`)
    assert.ok(n === 1 || medianIndex(n) < n - 1, `index must not be the maximum for ${n}`)
  }
})

test('a thin month publishes nothing rather than something unconvincing', () => {
  // "2 customer actions in 30 days" on a page selling a 19.99/mo plan argues
  // against buying. The honest answer to weak data is an absent panel.
  const candidates = [candidate('a', { click_website: 2 }), candidate('b', { view: 4000, lead: 1 })]
  assert.equal(pickRepresentativeProof(candidates), null)
})

test('the publish floor is a real floor, not a formality', () => {
  assert.ok(MIN_ACTIONS_TO_PUBLISH >= 5, 'a handful of actions is not evidence')
  const justUnder = [candidate('a', { click_website: MIN_ACTIONS_TO_PUBLISH - 1 })]
  const justOver = [candidate('a', { click_website: MIN_ACTIONS_TO_PUBLISH })]
  assert.equal(pickRepresentativeProof(justUnder), null)
  assert.ok(pickRepresentativeProof(justOver))
})

test('no listing is identifiable from what the page receives', () => {
  // A paying customer did not agree to have their performance advertised. The
  // returned shape must carry no id, name, or anything resembling one.
  const proof = pickRepresentativeProof([
    candidate('super-h-automotive', { click_website: 10, lead: 2 }),
    candidate('varsity-roofing', { click_website: 30 }),
    candidate('cardon-insurance', { click_phone: 90 }),
  ])
  assert.ok(proof)
  const serialized = JSON.stringify(proof)
  for (const id of ['super-h', 'varsity', 'cardon', 'listingId']) {
    assert.doesNotMatch(serialized, new RegExp(id, 'i'), `${id} must not reach the page`)
  }
  assert.deepEqual(Object.keys(proof).sort(), [
    'actions',
    'calls',
    'directions',
    'leads',
    'sampleSize',
    'views',
    'website',
    'windowDays',
  ])
})

test('the same data always publishes the same figure', () => {
  // Firestore returns documents in no guaranteed order. Without a deterministic
  // tie-break the published number could change between two page renders of the
  // same underlying month, which is its own kind of untrustworthy.
  const base = [
    candidate('b', { click_website: 10 }),
    candidate('a', { click_website: 10 }),
    candidate('c', { click_website: 10 }),
    candidate('d', { click_website: 44 }),
  ]
  const first = pickRepresentativeProof(base)
  const shuffled = pickRepresentativeProof([base[3], base[1], base[2], base[0]])
  assert.deepEqual(first, shuffled)
})

test('an empty catalog is not an error', () => {
  assert.equal(pickRepresentativeProof([]), null)
})

test('low performers remain in the median instead of cherry-picking qualifying listings', () => {
  assert.equal(pickRepresentativeProof([
    candidate('a'), candidate('b'), candidate('c', { click_website: 100 }),
  ]), null)
  const proof = pickRepresentativeProof([
    candidate('a'), candidate('b', { click_website: 6 }), candidate('c', { click_website: 100 }),
  ])
  assert.equal(proof?.actions, 6)
  assert.equal(proof?.sampleSize, 3)
})

// --- Tiles ----------------------------------------------------------------------

test('a zero tile is dropped rather than advertised', () => {
  // "0 leads" on a page arguing Premium produces leads is an argument against
  // buying it.
  const proof = pickRepresentativeProof([candidate('a', { click_website: 6, click_phone: 3 })])
  assert.ok(proof)
  const tiles = proofTiles(proof)
  assert.deepEqual(tiles.map((t) => t.key), ['website', 'calls'])
  assert.ok(tiles.every((t) => t.value > 0))
})

test('tiles lead with the largest number', () => {
  const proof = pickRepresentativeProof([
    candidate('a', { click_website: 3, click_directions: 9, click_phone: 5, lead: 1 }),
  ])
  assert.ok(proof)
  assert.deepEqual(proofTiles(proof).map((t) => t.value), [9, 5, 3, 1])
})
