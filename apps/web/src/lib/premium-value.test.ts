import test from 'node:test'
import assert from 'node:assert/strict'
import {
  customerActionTotal,
  deterministicSocialCaptions,
  listingTrustSignalKeys,
  normalizeLeadStatus,
} from './premium-value'

test('customer actions combine attributable outcomes', () => {
  assert.equal(customerActionTotal({ website: 2, directions: 3, actions: 4, leads: 1 }), 10)
})

test('lead status accepts only the supported workflow states', () => {
  assert.equal(normalizeLeadStatus('won'), 'won')
  assert.equal(normalizeLeadStatus('anything'), 'new')
})

test('trust signals are factual and derived from listing activity', () => {
  const now = new Date('2026-10-16T18:00:00-06:00')
  const keys = listingTrustSignalKeys({
    claimStatus: 'approved',
    updatedAt: '2026-10-10T12:00:00-06:00',
    hasOwnerReply: true,
    hasOwnerAnswer: true,
    views30: 125,
    now,
    posts: [{ id: '1', type: 'offer', title: 'Deal', title_es: '', body: '', body_es: '', starts_at: null, ends_at: '2026-10-20', cta_url: null, created_at: now.toISOString() }],
  })
  assert.deepEqual(keys, ['verified', 'fresh', 'responsive', 'offer', 'answers', 'milestone'])
})

test('social captions are deterministic and include the business URL', () => {
  const captions = deterministicSocialCaptions({ name: 'Example Co.', url: 'https://citybeatmag.co/b/abc', locale: 'en' })
  assert.equal(captions.length, 3)
  assert.ok(captions.every((caption) => caption.includes('https://citybeatmag.co/b/abc')))
})
