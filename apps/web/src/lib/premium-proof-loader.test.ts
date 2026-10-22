import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPremiumProof, PROOF_SCAN_LIMIT, type ProofReader } from './premium-proof-loader'
import { isPaidProofListing, type ProofListing } from './premium-proof'

const paid = (listingId: string): ProofListing => ({ listingId, tier: 'premium', is_published: true, stripe_subscription_id: 'sub_example' })

test('paid proof excludes free grants, unpublished and merged records', () => {
  assert.equal(isPaidProofListing(paid('a')), true)
  for (const change of [
    { stripe_subscription_id: undefined }, { stripe_subscription_id: ' ' },
    { tier: 'basic' }, { is_published: false }, { merged_into: 'canonical' },
  ]) assert.equal(isPaidProofListing({ ...paid('a'), ...change }), false)
})

test('eligibility precedes sampling and stats reads stay bounded', async () => {
  let readIds: string[] = []
  const result = await loadPremiumProof({
    listings: async limit => {
      assert.equal(limit, PROOF_SCAN_LIMIT)
      return [...Array.from({ length: 12 }, (_, i) => ({ ...paid(`comp${i}`), stripe_subscription_id: undefined })),
        ...Array.from({ length: 20 }, (_, i) => paid(`paid_${i}`))]
    },
    stats: async (ids, days) => {
      readIds = ids
      assert.equal(days.length, 30)
      assert.equal(days[0], '2026-10-22')
      assert.equal(days.at(-1), '2026-09-23')
      return ids.map(listingId => ({ listingId, counts: { click_website: 6 } }))
    },
  }, new Date('2026-10-22T00:00:01Z'))
  assert.equal(readIds.length, 12)
  assert.ok(readIds.every(id => id.startsWith('paid_')))
  assert.equal(result.proof?.sampleSize, 12)
  assert.equal(result.diagnostics.eligible, 20)
  assert.doesNotMatch(JSON.stringify(result), /paid_|sub_example/)
})

test('thin and missing data are successful diagnostic outcomes, not exceptions', async () => {
  const result = await loadPremiumProof({
    listings: async () => [paid('a'), paid('b')],
    stats: async () => [{ listingId: 'a', counts: { view: 12 } }],
  })
  assert.equal(result.proof, null)
  assert.equal(result.diagnostics.status, 'insufficient_activity')
  assert.equal(result.diagnostics.listingsWithStats, 1)
  assert.equal(result.diagnostics.views, 12)
  assert.equal(result.diagnostics.actions, 0)
  const empty = await loadPremiumProof({ listings: async () => [], stats: async () => { throw new Error('must not read') } })
  assert.equal(empty.diagnostics.status, 'no_eligible_listings')
})

test('database failures propagate for operational alerting', async () => {
  const failure = new Error('database unavailable')
  const readers: ProofReader[] = [
    { listings: async () => { throw failure }, stats: async () => [] },
    { listings: async () => [paid('a')], stats: async () => { throw failure } },
  ]
  for (const reader of readers) await assert.rejects(loadPremiumProof(reader), error => error === failure)
})

test('malformed counters cannot generate publishable proof', async () => {
  const result = await loadPremiumProof({
    listings: async () => [paid('a')],
    stats: async () => [{ listingId: 'a', counts: { click_website: Infinity, click_phone: -10, lead: NaN } }],
  })
  assert.equal(result.proof, null)
  assert.equal(result.diagnostics.actions, 0)
})
