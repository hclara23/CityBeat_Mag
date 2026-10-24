import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_CREATOR_UPLOAD_BYTES, canUploadCreatorMedia, resolveClaimVerification, sanitizePublicReview, shouldAwardReviewPoints, validateCreatorUploadFile } from './directory-security'

test('claim verification sends phone codes only to the trusted listing phone', () => {
  const result = resolveClaimVerification({
    method: 'phone',
    requestedContact: '+1 999 999 9999',
    listing: {
      name: 'Trusted Cafe',
      claim_status: 'unclaimed',
      phone: '(915) 555-0100',
    },
  })

  assert.deepEqual(result, {
    ok: true,
    status: 'code_sent',
    notificationType: 'sms',
    recipient: '(915) 555-0100',
  })
})

test('claim verification rejects email when the listing has no trusted email field', () => {
  const result = resolveClaimVerification({
    method: 'email',
    requestedContact: 'attacker@example.com',
    listing: {
      name: 'No Email Business',
      claim_status: 'unclaimed',
      phone: '(915) 555-0100',
    },
  })

  assert.deepEqual(result, {
    ok: false,
    statusCode: 400,
    error: 'Email verification is unavailable for this listing.',
  })
})

test('public review projection removes reviewer email addresses', () => {
  const review = sanitizePublicReview({
    id: 'review-1',
    rating: 5,
    profiles: {
      full_name: 'Reader One',
      email: 'reader@example.com',
      avatar_url: 'https://example.com/avatar.png',
    },
  })

  assert.deepEqual(review.profiles, {
    full_name: 'Reader One',
    avatar_url: 'https://example.com/avatar.png',
  })
  assert.equal('email' in review.profiles, false)
})

test('review points are awarded only for a non-advertiser first review', () => {
  assert.equal(shouldAwardReviewPoints({ isAdvertiser: false, hasExistingReview: false }), true)
  assert.equal(shouldAwardReviewPoints({ isAdvertiser: false, hasExistingReview: true }), false)
  assert.equal(shouldAwardReviewPoints({ isAdvertiser: true, hasExistingReview: false }), false)
})

test('creator uploads require creator access and enforce size/type limits', () => {
  assert.equal(canUploadCreatorMedia({ is_writer: true }), true)
  assert.equal(canUploadCreatorMedia({ role: 'visitor' }), false)

  assert.deepEqual(validateCreatorUploadFile({ type: 'image/png', size: MAX_CREATOR_UPLOAD_BYTES }), {
    ok: true,
  })
  assert.deepEqual(validateCreatorUploadFile({ type: 'image/png', size: MAX_CREATOR_UPLOAD_BYTES + 1 }), {
    ok: false,
    error: 'Image must be 8MB or smaller.',
  })
  assert.deepEqual(validateCreatorUploadFile({ type: 'text/html', size: 100 }), {
    ok: false,
    error: 'Invalid file type.',
  })
})

// --- Phone verification, and the address precedence bug ----------------------
//
// Measured against the live collection: 8,863 of 9,790 listings carry a phone
// and only 787 carry an email. Email-only verification left roughly 82% of the
// directory unclaimable by the owner it belongs to.

test('a listing with only a phone can still be verified', () => {
  const r = resolveClaimVerification({
    method: 'phone',
    listing: { name: 'Taco Shop', claim_status: 'unclaimed', phone: '+1 915 555 0100' },
  })
  assert.equal(r.ok, true)
  assert.equal(r.ok && r.notificationType, 'sms')
  assert.equal(r.ok && r.recipient, '+1 915 555 0100')
})

test('phone verification is refused when there is no number on record', () => {
  const r = resolveClaimVerification({
    method: 'phone',
    listing: { name: 'Taco Shop', claim_status: 'unclaimed', phone: '   ' },
  })
  assert.equal(r.ok, false)
})

test('the verifier accepts the same address the claim hint showed', () => {
  // The bug: api/directory/[id]/route.ts masks `email || contact_email` into the
  // hint, while this resolver read only `email`. A listing carrying
  // contact_email therefore displayed a masked address to the owner and then
  // refused to send a code to it — a dead end at the exact moment of conversion.
  const r = resolveClaimVerification({
    method: 'email',
    listing: { name: 'Taco Shop', claim_status: 'unclaimed', contact_email: 'owner@tacoshop.com' },
  })
  assert.equal(r.ok, true)
  assert.equal(r.ok && r.recipient, 'owner@tacoshop.com')
})

test('a real email still wins over contact_email', () => {
  const r = resolveClaimVerification({
    method: 'email',
    listing: {
      name: 'Taco Shop',
      claim_status: 'unclaimed',
      email: 'primary@tacoshop.com',
      contact_email: 'rep-entered@example.com',
    },
  })
  assert.equal(r.ok && r.recipient, 'primary@tacoshop.com')
})

test('an already-claimed listing is refused on every method', () => {
  for (const method of ['email', 'phone', 'postcard'] as const) {
    const r = resolveClaimVerification({
      method,
      listing: { name: 'Taco Shop', claim_status: 'approved', phone: '+19155550100', email: 'a@b.com' },
    })
    assert.equal(r.ok, false, `${method} must not start a claim on a claimed listing`)
  }
})
