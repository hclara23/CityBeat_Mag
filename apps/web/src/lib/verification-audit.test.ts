import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVerificationAuditRecord,
  claimTokenExpired,
  claimTokenExpiresAt,
  claimTokenMatches,
  evaluateClaimAcceptance,
  hashRequestIp,
  mintClaimToken,
  normalizeAttestationMethod,
  summarizeUserAgent,
  validateBypass,
} from './verification-audit'

const NOW = Date.parse('2026-07-30T12:00:00.000Z')

test('attestation method only accepts the two allowed values', () => {
  assert.equal(normalizeAttestationMethod('in_person_at_business'), 'in_person_at_business')
  assert.equal(normalizeAttestationMethod('personally_knows_owner'), 'personally_knows_owner')
  assert.equal(normalizeAttestationMethod('made_it_up'), null)
  assert.equal(normalizeAttestationMethod(''), null)
  assert.equal(normalizeAttestationMethod(undefined), null)
})

test('validateBypass requires a method, an accepted attestation, and a customer email', () => {
  assert.equal(validateBypass({ attestationMethod: 'bad', attestationAccepted: true, customerEmail: 'a@b.com' }).ok, false)
  assert.equal(validateBypass({ attestationMethod: 'in_person_at_business', attestationAccepted: false, customerEmail: 'a@b.com' }).ok, false)
  assert.equal(validateBypass({ attestationMethod: 'in_person_at_business', attestationAccepted: true, customerEmail: '' }).ok, false)

  const ok = validateBypass({
    attestationMethod: 'personally_knows_owner',
    attestationAccepted: true,
    customerEmail: 'owner@shop.com',
    attestationNote: '  met at the counter  ',
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.method, 'personally_knows_owner')
    assert.equal(ok.note, 'met at the counter')
  }
})

test('validateBypass caps the internal note length', () => {
  const res = validateBypass({
    attestationMethod: 'in_person_at_business',
    attestationAccepted: true,
    customerEmail: 'a@b.com',
    attestationNote: 'x'.repeat(900),
  })
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.note.length, 500)
})

test('request IP hash is deterministic, salted, and never the raw IP', () => {
  const h = hashRequestIp('203.0.113.7')
  assert.match(h, /^[a-f0-9]{64}$/)
  assert.equal(h, hashRequestIp('203.0.113.7'))
  assert.notEqual(h, hashRequestIp('203.0.113.8'))
  assert.ok(!h.includes('203.0.113.7'))
  assert.equal(hashRequestIp(null), hashRequestIp(undefined)) // both fold to 'unknown'
})

test('user-agent summary collapses whitespace, truncates, and defaults to unknown', () => {
  assert.equal(summarizeUserAgent(null), 'unknown')
  assert.equal(summarizeUserAgent('   '), 'unknown')
  assert.equal(summarizeUserAgent('Mozilla/5.0   (X)\n Safari'), 'Mozilla/5.0 (X) Safari')
  assert.equal(summarizeUserAgent('a'.repeat(500)).length, 200)
})

test('the audit record captures the responsible salesperson, method, and normalized customer email', () => {
  const rec = buildVerificationAuditRecord({
    listingId: 'listing-1',
    salespersonId: 'rep-1',
    salespersonEmail: 'REP@citybeat.co',
    method: 'in_person_at_business',
    note: 'storefront visit',
    customerEmail: 'Owner@Shop.com',
    ip: '203.0.113.7',
    userAgent: 'Mozilla/5.0',
    now: '2026-07-30T12:00:00.000Z',
  })
  assert.equal(rec.verification_path, 'salesperson_attestation')
  assert.equal(rec.salesperson_id, 'rep-1')
  assert.equal(rec.salesperson_email, 'rep@citybeat.co')
  assert.equal(rec.attestation_method, 'in_person_at_business')
  assert.equal(rec.customer_email_normalized, 'owner@shop.com')
  assert.match(rec.request_ip_hash, /^[a-f0-9]{64}$/)
  assert.equal(rec.user_agent_summary, 'Mozilla/5.0')
})

test('claim tokens match only their own hash and reject tampering', () => {
  const { token, hash } = mintClaimToken()
  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.equal(claimTokenMatches(token, hash), true)
  assert.equal(claimTokenMatches(token + 'x', hash), false)
  assert.equal(claimTokenMatches('', hash), false)
  assert.equal(claimTokenMatches(token, null), false)
  assert.equal(claimTokenMatches(token, 'not-a-hash'), false)
  const other = mintClaimToken()
  assert.equal(claimTokenMatches(token, other.hash), false)
})

test('claim token expiry is enforced', () => {
  const exp = claimTokenExpiresAt(NOW)
  assert.equal(claimTokenExpired(exp, NOW), false)
  assert.equal(claimTokenExpired(exp, NOW + 15 * 24 * 60 * 60 * 1000), true)
  assert.equal(claimTokenExpired(undefined, NOW), true)
  assert.equal(claimTokenExpired('not-a-date', NOW), true)
})

function bypassListing(overrides = {}) {
  const { token, hash } = mintClaimToken()
  const listing = {
    claim_status: 'unclaimed',
    owner_id: null,
    contact_email: 'owner@shop.com',
    verification_path: 'salesperson_attestation',
    claim_token_hash: hash,
    claim_token_expires_at: claimTokenExpiresAt(NOW),
    claim_token_consumed_at: null,
    requested_product_id: 'directory_basic_free',
    ...overrides,
  }
  return { token, listing }
}

test('acceptance succeeds for the right customer with a valid free-listing token', () => {
  const { token, listing } = bypassListing()
  const res = evaluateClaimAcceptance({ token, userEmail: 'Owner@Shop.com', listing, nowMs: NOW })
  assert.deepEqual(res, { ok: true, isPaid: false })
})

test('acceptance flags paid listings so the tier stays gated on Stripe', () => {
  const { token, listing } = bypassListing({ requested_product_id: 'directory_premium_monthly' })
  const res = evaluateClaimAcceptance({ token, userEmail: 'owner@shop.com', listing, nowMs: NOW })
  assert.deepEqual(res, { ok: true, isPaid: true })
})

test('the wrong customer email cannot accept the bypassed claim', () => {
  const { token, listing } = bypassListing()
  const res = evaluateClaimAcceptance({ token, userEmail: 'attacker@evil.com', listing, nowMs: NOW })
  assert.equal(res.ok, false)
  if (!res.ok) {
    assert.equal(res.status, 403)
    assert.equal(res.code, 'wrong_email')
  }
})

test('a tampered, wrong, or missing token is rejected', () => {
  const { token, listing } = bypassListing()
  assert.equal(evaluateClaimAcceptance({ token: token + 'x', userEmail: 'owner@shop.com', listing, nowMs: NOW }).ok, false)
  assert.equal(evaluateClaimAcceptance({ token: '', userEmail: 'owner@shop.com', listing, nowMs: NOW }).ok, false)
  assert.equal(evaluateClaimAcceptance({ token: 'guessed', userEmail: 'owner@shop.com', listing, nowMs: NOW }).ok, false)
})

test('a consumed (single-use) or already-owned token cannot be reused', () => {
  const consumed = bypassListing({ claim_token_consumed_at: '2026-07-30T11:00:00.000Z' })
  const c = evaluateClaimAcceptance({ token: consumed.token, userEmail: 'owner@shop.com', listing: consumed.listing, nowMs: NOW })
  assert.equal(c.ok, false)
  if (!c.ok) assert.equal(c.status, 409)

  const owned = bypassListing({ owner_id: 'someone-else' })
  const o = evaluateClaimAcceptance({ token: owned.token, userEmail: 'owner@shop.com', listing: owned.listing, nowMs: NOW })
  assert.equal(o.ok, false)
  if (!o.ok) assert.equal(o.status, 409)
})

test('an expired token is rejected even for the right customer', () => {
  const { token, listing } = bypassListing()
  const res = evaluateClaimAcceptance({
    token,
    userEmail: 'owner@shop.com',
    listing,
    nowMs: NOW + 30 * 24 * 60 * 60 * 1000,
  })
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.status, 403)
})

test('a non-bypass listing (no attestation/token) is not directly acceptable', () => {
  const res = evaluateClaimAcceptance({
    token: 'anything',
    userEmail: 'owner@shop.com',
    listing: { claim_status: 'unclaimed', contact_email: 'owner@shop.com', verification_path: null, claim_token_hash: null },
    nowMs: NOW,
  })
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.status, 400)
})
