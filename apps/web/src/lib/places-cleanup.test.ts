import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyListing, protectionReason, summarize, PROTECTED_NAMES } from './places-cleanup'

// These rules decide whether a script deletes a real business's public listing.
// The asymmetry is the whole point: a false positive leaves one extra directory
// row, a false negative destroys a paying customer's page. Every test here is
// about the second kind.

const google = { google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4', source_url: null }

test('an ordinary crawled Google row with nobody attached is removable', () => {
  const v = classifyListing({ id: 'g1', name: 'Some Taqueria', claim_status: 'unclaimed', ...google })
  assert.equal(v.googleDerived, true)
  assert.equal(v.protection, null)
  assert.equal(v.removable, true)
})

test('anyone who has touched a claim is protected, at every stage', () => {
  for (const status of ['approved', 'pending_approval', 'verified', 'started', 'rejected']) {
    const v = classifyListing({ id: 'x', name: 'Claimed Co', claim_status: status, ...google })
    assert.equal(v.removable, false, `claim_status ${status} must be protected`)
    assert.equal(v.protection, 'claimed')
  }
})

test('an owner, a subscription, a paid tier or a rep all protect a row', () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ owner_id: 'user-1' }, 'has_owner'],
    [{ stripe_subscription_id: 'sub_123' }, 'paying'],
    [{ tier: 'premium' }, 'paying'],
    [{ tier: 'featured' }, 'paying'],
    [{ pending_tier: 'premium' }, 'paying'],
    [{ sold_by_rep: 'rep-7' }, 'rep_sold'],
  ]
  for (const [extra, reason] of cases) {
    const v = classifyListing({ id: 'x', name: 'Attached Co', claim_status: 'unclaimed', ...google, ...extra })
    assert.equal(v.removable, false, `${reason} must be protected`)
    assert.equal(v.protection, reason)
  }
})

test('Varsity Roofing is protected however its name is written', () => {
  assert.ok(PROTECTED_NAMES.includes('varsity roofing'))
  for (const name of ['Varsity Roofing', 'VARSITY ROOFING', '  varsity   roofing  ', 'Varsity-Roofing']) {
    const v = classifyListing({ id: 'vr', name, claim_status: 'unclaimed', ...google })
    assert.equal(v.protection, 'allowlisted', `"${name}" must be allowlisted`)
    assert.equal(v.removable, false)
  }
})

test('a row that is NOT Google-derived is never removable, protected or not', () => {
  // Open-data and own-website rows are ours to keep. The cleanup exists for a
  // Google licence problem and must not become a general directory purge.
  for (const src of [
    { google_place_id: 'sf:9f2a1b', source_url: 'https://data.texas.gov/resource/7358-krk7' },
    { google_place_id: null, source_url: 'https://someroofer.com' },
    { google_place_id: null, source_url: null },
  ]) {
    const v = classifyListing({ id: 'k', name: 'Open Data Co', claim_status: 'unclaimed', ...src })
    assert.equal(v.googleDerived, false)
    assert.equal(v.removable, false)
  }
})

test('a Google source_url alone is enough, even with a synthetic id', () => {
  const v = classifyListing({
    id: 'g2',
    name: 'Maps Row',
    claim_status: 'unclaimed',
    google_place_id: 'sf:abc',
    source_url: 'https://www.google.com/maps/place/?q=place_id:ChIJxyz',
  })
  assert.equal(v.googleDerived, true)
  assert.equal(v.removable, true)
})

test('a lookalike host is not Google', () => {
  const v = classifyListing({
    id: 'g3',
    name: 'Not Google',
    claim_status: 'unclaimed',
    google_place_id: 'sf:abc',
    source_url: 'https://google.com.evil.example.net/maps',
  })
  assert.equal(v.googleDerived, false)
  assert.equal(v.removable, false)
})

test('protection wins over provenance, always', () => {
  // The one invariant that matters: there is no combination of inputs where a
  // protected listing comes back removable.
  const protections = [
    { claim_status: 'approved' },
    { owner_id: 'u' },
    { stripe_subscription_id: 's' },
    { tier: 'featured' },
    { pending_tier: 'premium' },
    { sold_by_rep: 'r' },
    { name: 'Varsity Roofing' },
  ]
  for (const p of protections) {
    const v = classifyListing({ id: 'x', name: 'Co', claim_status: 'unclaimed', ...google, ...p })
    assert.notEqual(v.protection, null)
    assert.equal(v.removable, false)
  }
})

test('an empty or missing claim_status is treated as unclaimed, not as protection', () => {
  // Guarding against the opposite error: if absence read as "claimed", the
  // cleanup would silently do nothing and the licence problem would persist
  // while appearing solved.
  assert.equal(protectionReason({ id: 'a', name: 'A', claim_status: '' }), null)
  assert.equal(protectionReason({ id: 'b', name: 'B' }), null)
  assert.equal(protectionReason({ id: 'c', name: 'C', claim_status: 'unclaimed' }), null)
})

test('the summary counts what a human needs before authorising anything', () => {
  const verdicts = [
    classifyListing({ id: '1', name: 'Removable', claim_status: 'unclaimed', ...google }),
    classifyListing({ id: '2', name: 'Claimed', claim_status: 'approved', ...google }),
    classifyListing({ id: '3', name: 'Varsity Roofing', claim_status: 'unclaimed', ...google }),
    classifyListing({ id: '4', name: 'Open data', claim_status: 'unclaimed', google_place_id: 'sf:1' }),
  ]
  const s = summarize(verdicts)
  assert.equal(s.scanned, 4)
  assert.equal(s.googleDerived, 3)
  assert.equal(s.removable, 1)
  assert.equal(s.protectedGoogleDerived, 2)
  assert.deepEqual(s.protectionBreakdown, { claimed: 1, allowlisted: 1 })
})
