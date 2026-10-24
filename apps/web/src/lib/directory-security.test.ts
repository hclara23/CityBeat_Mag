import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_CREATOR_UPLOAD_BYTES, canUploadCreatorMedia, isListingClaimable, isUnownedApprovedListing, resolveClaimVerification, sanitizePublicReview, shouldAwardReviewPoints, validateCreatorUploadFile } from './directory-security'

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
  // The fixture carries an owner_id deliberately. 'approved' alone is no longer
  // sufficient to mean "claimed" — an approved listing with NO owner is the
  // rep-sold lockout and must stay claimable (see the tests below). What makes
  // a listing claimed is that somebody actually owns it.
  for (const method of ['email', 'phone', 'postcard'] as const) {
    const r = resolveClaimVerification({
      method,
      listing: {
        name: 'Taco Shop',
        claim_status: 'approved',
        owner_id: 'owner-uid-123',
        phone: '+19155550100',
        email: 'a@b.com',
      } as never,
    })
    assert.equal(r.ok, false, `${method} must not start a claim on a claimed listing`)
  }
})

// --- The rep-sold lockout -----------------------------------------------------
//
// Varsity Roofing: claim_status 'approved', is_published true, founding_member
// true, active subscription sub_1U72lp…, owner_id null, ownership_verified
// false. A paying customer who could not sign in, manage their page, or see a
// lead — and no self-serve route back, because BOTH claim gates only accepted
// 'unclaimed'. The sale completed and nobody ever attached an account.

test('an approved listing with no owner is still claimable', () => {
  // The lockout, in one assertion.
  assert.equal(isUnownedApprovedListing({ claim_status: 'approved', owner_id: null }), true)
  assert.equal(isListingClaimable({ claim_status: 'approved', owner_id: null }), true)
  const r = resolveClaimVerification({
    method: 'email',
    listing: {
      name: 'Varsity Roofing',
      claim_status: 'approved',
      email: 'thomas@example.com',
      phone: '19152026730',
    },
  })
  assert.equal(r.ok, true, 'the paying owner must be able to start a claim')
})

test('an approved listing WITH an owner is not claimable by someone else', () => {
  // The security boundary this must not cross. Super H Automotive is approved
  // with a real owner_id; a stranger must not be able to claim it.
  assert.equal(isUnownedApprovedListing({ claim_status: 'approved', owner_id: 'N1iU8iaRDR' }), false)
  assert.equal(isListingClaimable({ claim_status: 'approved', owner_id: 'N1iU8iaRDR' }), false)
  const r = resolveClaimVerification({
    method: 'email',
    listing: { name: 'Super H', claim_status: 'approved', owner_id: 'N1iU8iaRDR', email: 'a@b.com' } as never,
  })
  assert.equal(r.ok, false)
})

test('a blank or whitespace owner_id counts as no owner', () => {
  // Firestore rows written by different paths use '' and null interchangeably;
  // a truthiness check on '' would leave those owners locked out too.
  for (const owner of ['', '   ', null, undefined]) {
    assert.equal(
      isUnownedApprovedListing({ claim_status: 'approved', owner_id: owner }),
      true,
      `owner_id ${JSON.stringify(owner)} must read as unowned`
    )
  }
})

test('pending_approval and rejected are NOT re-openable by this rule', () => {
  // Only 'approved' qualifies. A pending claim belongs to whoever started it,
  // and widening this to pending_approval would let a second person hijack an
  // in-flight claim.
  assert.equal(isUnownedApprovedListing({ claim_status: 'pending_approval', owner_id: null }), false)
  assert.equal(isUnownedApprovedListing({ claim_status: 'rejected', owner_id: null }), false)
  assert.equal(isListingClaimable({ claim_status: 'pending_approval', owner_id: null }), false)
})

test('an unclaimed listing is still claimable, as before', () => {
  assert.equal(isListingClaimable({ claim_status: 'unclaimed', owner_id: null }), true)
})
