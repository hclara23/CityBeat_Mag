import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLAIM_FUNNEL_STEPS, describeClaimFunnel, summarizeClaimFunnel } from './claim-funnel'

test('the funnel counts views, who was signed out, code outcomes and checkouts', () => {
  const s = summarizeClaimFunnel([
    { step: 'view', listing_id: 'a', signed_in: false },
    { step: 'view', listing_id: 'a', signed_in: false },
    { step: 'view', listing_id: 'b', signed_in: true },
    { step: 'code_requested', listing_id: 'b', outcome: 'sent' },
    { step: 'code_requested', listing_id: 'c', outcome: 'sms_not_enabled' },
    { step: 'code_requested', listing_id: 'd', outcome: 'sms_not_enabled' },
    { step: 'code_requested', listing_id: 'e' },
    { step: 'checkout_started', listing_id: 'b' },
    { step: 'something_else', listing_id: 'z' },
  ])
  assert.deepEqual(s, {
    views: 3, view_listings: 2, views_signed_out: 2,
    code_requests: 4, codes_sent: 1, code_failures: { sms_not_enabled: 2, unknown: 1 },
    checkouts: 1,
  })
})

test('a visitor whose sign-in state is unknown is not counted as signed out', () => {
  const s = summarizeClaimFunnel([{ step: 'view', listing_id: 'a', signed_in: null }, { step: 'view', listing_id: 'b' }])
  assert.equal(s.views, 2)
  assert.equal(s.views_signed_out, 0)
})

test('the digest line says what happened, and says so plainly when nothing did', () => {
  assert.equal(describeClaimFunnel(summarizeClaimFunnel([])), 'no claim activity recorded')
  const line = describeClaimFunnel(
    summarizeClaimFunnel([
      { step: 'view', listing_id: 'a', signed_in: false },
      { step: 'code_requested', listing_id: 'a', outcome: 'sms_not_enabled' },
    ])
  )
  assert.match(line, /1 claim page views \(1 businesses, 1 signed out\)/)
  assert.match(line, /1 code requests \(0 sent; not sent: sms not enabled 1\)/)
  assert.match(line, /0 checkouts started/)
})

test('exactly the three steps that used to leave no trace are tracked', () => {
  assert.deepEqual([...CLAIM_FUNNEL_STEPS], ['view', 'code_requested', 'checkout_started'])
})
