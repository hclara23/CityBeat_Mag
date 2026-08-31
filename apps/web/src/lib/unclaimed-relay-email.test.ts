import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RELAY_MONTHLY_CAP,
  buildRelayEmail,
  relayContactEmail,
  relayDedupeKey,
  relayEligible,
} from './unclaimed-relay-email'

const BASE = { claim_status: 'unclaimed', email: 'owner@example.com', name: 'Tacos El Rey' }

test('only unclaimed, canonical listings with a contact are relay-eligible', () => {
  assert.equal(relayEligible(BASE), true)
  // Claimed / pending listings have real notifications — never relay.
  assert.equal(relayEligible({ ...BASE, claim_status: 'approved' }), false)
  assert.equal(relayEligible({ ...BASE, claim_status: 'pending_approval' }), false)
  // Consolidated-away duplicates are not canonical.
  assert.equal(relayEligible({ ...BASE, merged_into: 'abc123' }), false)
  // No contact → nothing to relay to.
  assert.equal(relayEligible({ ...BASE, email: null }), false)
  assert.equal(relayEligible({ ...BASE, email: 'not-an-email' }), false)
  assert.equal(relayEligible(null), false)
  // Rep-sold listings are 'unclaimed' only until admin approval — they are
  // PAYING customers and must never get "claim your page" mail.
  assert.equal(relayEligible({ ...BASE, sold_by_rep: 'rep-1' }), false)
  assert.equal(relayEligible({ ...BASE, source: 'sales_rep' }), false)
  assert.equal(relayEligible({ ...BASE, sales_order_id: 'so-1' }), false)
})

test('contact prefers contact_email over the enriched email field', () => {
  assert.equal(relayContactEmail({ email: 'scraped@biz.com', contact_email: 'real@biz.com' }), 'real@biz.com')
  assert.equal(relayContactEmail({ email: '  scraped@biz.com  ' }), 'scraped@biz.com')
  assert.equal(relayContactEmail({}), null)
})

test('dedupe key is stable per event and type-scoped', () => {
  assert.equal(relayDedupeKey('review', 'r1'), 'review:r1')
  assert.notEqual(relayDedupeKey('review', 'x'), relayDedupeKey('question', 'x'))
})

test('review email is bilingual, escapes user content, and deep-links both claim pages', () => {
  const { subject, html } = buildRelayEmail({
    listingId: 'L1',
    businessName: 'Tacos <El> Rey',
    detail: { type: 'review', rating: 4, comment: 'Great <b>food</b> & service' },
    unsubToken: 'a'.repeat(24),
  })
  assert.ok(subject.includes('reviewed'))
  // Escaped user content — no raw tags from the reviewer or the business name.
  assert.ok(html.includes('Tacos &lt;El&gt; Rey'))
  assert.ok(html.includes('Great &lt;b&gt;food&lt;/b&gt; &amp; service'))
  assert.ok(!html.includes('<b>food</b>'))
  // EN + ES claim links.
  assert.ok(html.includes('/en/directory/L1/claim'))
  assert.ok(html.includes('/es/directory/L1/claim'))
  // Unsubscribe + CAN-SPAM footer.
  assert.ok(html.includes('/api/track/unsub?x='))
  assert.ok(html.includes('El Paso'))
  // Stars render the rating.
  assert.ok(html.includes('★★★★☆'))
})

test('first free quote lead includes the full contact; later ones tease', () => {
  const full = buildRelayEmail({
    listingId: 'L1',
    businessName: 'Biz',
    detail: { type: 'quote', name: 'Ana', contact: 'ana@x.com', message: 'Need a fence', full: true },
    unsubToken: 'b'.repeat(24),
  })
  assert.ok(full.html.includes('ana@x.com'))
  assert.ok(full.html.includes('Need a fence'))
  const teaser = buildRelayEmail({
    listingId: 'L1',
    businessName: 'Biz',
    detail: { type: 'quote', name: 'Ana', contact: 'ana@x.com', message: 'Need a fence', full: false },
    unsubToken: 'c'.repeat(24),
  })
  // The teaser must NOT leak the lead's contact details.
  assert.ok(!teaser.html.includes('ana@x.com'))
  assert.ok(!teaser.html.includes('Need a fence'))
})

test('question + press emails carry their event content', () => {
  const q = buildRelayEmail({
    listingId: 'L1',
    businessName: 'Biz',
    detail: { type: 'question', question: 'Do you open Sundays?' },
    unsubToken: 'd'.repeat(24),
  })
  assert.ok(q.html.includes('Do you open Sundays?'))
  const p = buildRelayEmail({
    listingId: 'L1',
    businessName: 'Biz',
    detail: { type: 'press_mention', articleTitle: 'Local shops boom', articleUrl: 'https://citybeatmag.co/en/stories/x' },
    unsubToken: 'e'.repeat(24),
  })
  assert.ok(p.html.includes('Local shops boom'))
  assert.ok(p.html.includes('/en/stories/x'))
})

test('the monthly cap is a small, sane number', () => {
  assert.ok(RELAY_MONTHLY_CAP >= 2 && RELAY_MONTHLY_CAP <= 6)
})
