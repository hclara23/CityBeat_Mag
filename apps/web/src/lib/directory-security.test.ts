import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_CREATOR_UPLOAD_BYTES,
  canUploadCreatorMedia,
  resolveClaimVerification,
  sanitizePublicReview,
  shouldAwardReviewPoints,
  validateCreatorUploadFile,
} from './directory-security'

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
