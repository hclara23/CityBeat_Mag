import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENTITLEMENT_COPY,
  directoryPlanForListing,
  entitlementsForPlan,
  filterEntitledListingUpdate,
  isStaffOverrideWrite,
  normalizeListingTier,
  resolveEntitlements,
  resolveListingPatchAccess,
  type DirectoryEntitlements,
} from './directory-entitlements'

test('basic listings receive only core-profile entitlements', () => {
  const ent = resolveEntitlements({ tier: 'basic' })
  assert.equal(ent.coreProfile, true)
  assert.equal(ent.enhancedDescription, false)
  assert.equal(ent.socialLinks, false)
  assert.equal(ent.fullAnalytics, false)
  assert.equal(ent.detailedLeads, false)
  assert.equal(ent.aiAssistance, false)
  assert.equal(ent.mediaLimit, 1)
  assert.equal(ent.additionalManagers, 0)
  assert.equal(ent.priorityPlacement, false)
})

test('missing or unrecognized tier defaults to basic (no pre-payment activation)', () => {
  assert.deepEqual(resolveEntitlements({}), resolveEntitlements({ tier: 'basic' }))
  assert.deepEqual(resolveEntitlements(null), resolveEntitlements({ tier: 'basic' }))
  assert.deepEqual(resolveEntitlements(undefined), resolveEntitlements({ tier: 'basic' }))
  assert.deepEqual(resolveEntitlements({ tier: 'pending' }), resolveEntitlements({ tier: 'basic' }))
  // A requested plan alone must NOT unlock paid entitlements before payment
  // sets the tier — otherwise a listing could get Premium for free.
  assert.equal(resolveEntitlements({ plan: 'premium_monthly' }).enhancedDescription, false)
  assert.equal(resolveEntitlements({ plan: 'featured_monthly' }).priorityPlacement, false)
})

test('premium and founders share the same full entitlement set', () => {
  const premium = resolveEntitlements({ tier: 'premium', plan: 'premium_monthly' })
  // The meaningful invariant: founders is a distinct plan label but maps to the
  // exact Premium entitlements (not a tautology on resolveEntitlements, which
  // only reads tier — assert against the plan-keyed source of truth).
  assert.deepEqual(entitlementsForPlan('founders'), entitlementsForPlan('premium'))
  // A founders-labeled listing still authorizes every Premium paid write.
  const foundersListing = { tier: 'premium', plan: 'founding', founding_member: true }
  assert.equal(directoryPlanForListing(foundersListing), 'founders')
  const { rejected } = filterEntitledListingUpdate(
    { description: 'x', social_links: { fb: 'y' }, gallery_urls: ['a'] },
    { entitlements: resolveEntitlements(foundersListing) }
  )
  assert.equal(rejected.length, 0)
  assert.equal(premium.enhancedDescription, true)
  assert.equal(premium.socialLinks, true)
  assert.equal(premium.video, true)
  assert.equal(premium.servicesAndProducts, true)
  assert.equal(premium.postsOffersEvents, true)
  assert.equal(premium.fullAnalytics, true)
  assert.equal(premium.analyticsExport, true)
  assert.equal(premium.detailedLeads, true)
  assert.equal(premium.aiAssistance, true)
  assert.equal(premium.bookingLinks, true)
  assert.ok(premium.additionalManagers > 0)
  // Placement / benchmarking stay Featured-only.
  assert.equal(premium.priorityPlacement, false)
  assert.equal(premium.categoryBenchmarking, false)
})

test('featured receives every premium entitlement plus placement and benchmarking', () => {
  const premium = resolveEntitlements({ tier: 'premium' })
  const featured = resolveEntitlements({ tier: 'featured' })
  for (const key of Object.keys(premium) as (keyof DirectoryEntitlements)[]) {
    if (typeof premium[key] === 'boolean' && premium[key] === true) {
      assert.equal(featured[key], true, `featured must keep premium entitlement ${key}`)
    }
  }
  assert.equal(featured.priorityPlacement, true)
  assert.equal(featured.categoryBenchmarking, true)
  assert.equal(featured.multiLocation, true)
  // Higher ceilings are a real Featured differentiator — assert strict growth so
  // a regression that flattens them to Premium's values fails the test.
  assert.ok(featured.mediaLimit > premium.mediaLimit)
  assert.ok(featured.additionalManagers > premium.additionalManagers)
})

test('multi-location/bulk is Featured-only', () => {
  assert.equal(resolveEntitlements({ tier: 'basic' }).multiLocation, false)
  assert.equal(resolveEntitlements({ tier: 'premium' }).multiLocation, false)
  assert.equal(resolveEntitlements({ tier: 'featured' }).multiLocation, true)
})

test('directoryPlanForListing labels founders vs premium without changing entitlements', () => {
  assert.equal(directoryPlanForListing({ tier: 'premium', plan: 'founding' }), 'founders')
  assert.equal(directoryPlanForListing({ tier: 'premium', plan: 'founding_annual' }), 'founders')
  assert.equal(directoryPlanForListing({ tier: 'premium', founding: true }), 'founders')
  // The persisted DB field is `founding_member` (Stripe webhook) — a founder with
  // no plan id must still label as founders.
  assert.equal(directoryPlanForListing({ tier: 'premium', founding_member: true }), 'founders')
  assert.equal(directoryPlanForListing({ tier: 'premium', plan: 'premium_monthly' }), 'premium')
  assert.equal(directoryPlanForListing({ tier: 'premium' }), 'premium')
  assert.equal(directoryPlanForListing({ tier: 'featured' }), 'featured')
  assert.equal(directoryPlanForListing({ tier: 'basic' }), 'basic')
  assert.equal(directoryPlanForListing({}), 'basic')
  // The label maps back to identical entitlements for founders + premium.
  assert.deepEqual(entitlementsForPlan('founders'), entitlementsForPlan('premium'))
})

test('normalizeListingTier only accepts the two paid tiers', () => {
  assert.equal(normalizeListingTier('premium'), 'premium')
  assert.equal(normalizeListingTier('featured'), 'featured')
  assert.equal(normalizeListingTier('basic'), 'basic')
  assert.equal(normalizeListingTier(undefined), 'basic')
  assert.equal(normalizeListingTier(null), 'basic')
  assert.equal(normalizeListingTier('FEATURED'), 'basic') // case-sensitive, unknown → basic
  assert.equal(normalizeListingTier('enterprise'), 'basic')
})

test('basic API writes cannot set paid fields', () => {
  const ent = resolveEntitlements({ tier: 'basic' })
  const { updates, rejected } = filterEntitledListingUpdate(
    {
      name: 'Taco Shop',
      phone: '915-555-0000',
      description: 'A long premium description',
      gallery_urls: ['a', 'b'],
      social_links: { facebook: 'x' },
      image_url: 'cover.jpg',
    },
    { entitlements: ent }
  )
  assert.equal(updates.name, 'Taco Shop')
  assert.equal(updates.phone, '915-555-0000')
  assert.equal('description' in updates, false)
  assert.equal('gallery_urls' in updates, false)
  assert.equal('social_links' in updates, false)
  assert.equal('image_url' in updates, false)
  assert.deepEqual(rejected.sort(), ['description', 'gallery_urls', 'image_url', 'social_links'])
})

test('premium API writes may set paid fields', () => {
  const ent = resolveEntitlements({ tier: 'premium' })
  const { updates, rejected } = filterEntitledListingUpdate(
    { description: 'Story', social_links: { facebook: 'x' }, gallery_urls: ['a'] },
    { entitlements: ent }
  )
  assert.equal(updates.description, 'Story')
  assert.deepEqual(updates.gallery_urls, ['a'])
  assert.deepEqual(updates.social_links, { facebook: 'x' })
  assert.equal(rejected.length, 0)
})

test('staff override lets editors write paid fields on a basic listing', () => {
  const ent = resolveEntitlements({ tier: 'basic' })
  const { updates, rejected } = filterEntitledListingUpdate(
    { description: 'Edited by staff', social_links: { x: 'y' } },
    { entitlements: ent, isStaff: true }
  )
  assert.equal(updates.description, 'Edited by staff')
  assert.deepEqual(updates.social_links, { x: 'y' })
  assert.equal(rejected.length, 0)
})

test('the update filter is a strict allow-list — privileged fields never pass, even for staff', () => {
  const ent = resolveEntitlements({ tier: 'featured' })
  const { updates } = filterEntitledListingUpdate(
    {
      name: 'Ok',
      tier: 'featured',
      owner_id: 'attacker',
      claim_status: 'approved',
      stripe_customer_id: 'cus_x',
      sold_by_rep: 'rep-1',
      payout_user_id: 'attacker',
    },
    { entitlements: ent, isStaff: true }
  )
  assert.equal(updates.name, 'Ok')
  assert.equal('tier' in updates, false)
  assert.equal('owner_id' in updates, false)
  assert.equal('claim_status' in updates, false)
  assert.equal('stripe_customer_id' in updates, false)
  assert.equal('sold_by_rep' in updates, false)
  assert.equal('payout_user_id' in updates, false)
})

test('downgrade to basic blocks future paid writes (data retained elsewhere, edits stop)', () => {
  // A listing that was premium but downgraded (tier flipped back to basic)
  // resolves to basic entitlements — the stored gallery/description remain in
  // the document, but the owner can no longer edit the paid fields.
  const ent = resolveEntitlements({ tier: 'basic', plan: 'premium_monthly' })
  assert.equal(ent.enhancedDescription, false)
  const { rejected } = filterEntitledListingUpdate({ description: 'x' }, { entitlements: ent })
  assert.deepEqual(rejected, ['description'])
})

test('every lockable entitlement ships bilingual upgrade copy', () => {
  // Derive the lockable set from the entitlement keys (everything except the
  // never-locked coreProfile) so a newly added entitlement without copy fails
  // this test automatically, rather than relying on a hand-maintained list.
  const allKeys = Object.keys(resolveEntitlements({ tier: 'featured' })) as (keyof DirectoryEntitlements)[]
  const lockable = allKeys.filter((key) => key !== 'coreProfile')
  assert.ok(lockable.length >= 14)
  for (const key of lockable) {
    const copy = ENTITLEMENT_COPY[key]
    assert.ok(copy, `missing upgrade copy for ${key}`)
    assert.ok(copy.en.label && copy.en.benefit, `incomplete EN copy for ${key}`)
    assert.ok(copy.es.label && copy.es.benefit, `incomplete ES copy for ${key}`)
  }
})

test('resolveListingPatchAccess enforces the owner/staff boundary', () => {
  const listing = { owner_id: 'owner-1', claim_status: 'approved' }
  // Approved owner may manage; a staff bypass is not needed.
  assert.deepEqual(resolveListingPatchAccess(listing, { userId: 'owner-1' }), {
    isOwner: true,
    isStaff: false,
    canManage: true,
  })
  // A different user with no staff role is denied.
  assert.deepEqual(resolveListingPatchAccess(listing, { userId: 'someone-else' }), {
    isOwner: false,
    isStaff: false,
    canManage: false,
  })
  // Staff (editor/developer) may manage any listing, owned or not.
  assert.deepEqual(resolveListingPatchAccess(listing, { userId: 'someone-else', isStaff: true }), {
    isOwner: false,
    isStaff: true,
    canManage: true,
  })
  // A pending (not yet approved) claim does NOT grant owner edit rights.
  assert.equal(
    resolveListingPatchAccess({ owner_id: 'owner-1', claim_status: 'pending' }, { userId: 'owner-1' }).canManage,
    false
  )
  // No authenticated user id → never an owner.
  assert.equal(resolveListingPatchAccess(listing, { userId: null }).isOwner, false)
})

test('isStaffOverrideWrite flags only writes a plain owner could not make', () => {
  const basic = resolveEntitlements({ tier: 'basic' })
  const premium = resolveEntitlements({ tier: 'premium' })

  // A normal owner editing their own listing is never an override.
  assert.equal(
    isStaffOverrideWrite({ isStaff: false, isOwner: true, entitlements: premium, writtenFields: ['description'] }),
    false
  )
  // Staff editing a listing they do not own is always audited.
  assert.equal(
    isStaffOverrideWrite({ isStaff: true, isOwner: false, entitlements: premium, writtenFields: ['name'] }),
    true
  )
  // Staff who own the listing but wrote a paid field the tier does not entitle
  // (bypassing the gate) is audited.
  assert.equal(
    isStaffOverrideWrite({ isStaff: true, isOwner: true, entitlements: basic, writtenFields: ['description'] }),
    true
  )
  // Staff who own the listing and only touched core fields — no gate bypassed,
  // no audit needed.
  assert.equal(
    isStaffOverrideWrite({ isStaff: true, isOwner: true, entitlements: basic, writtenFields: ['name', 'phone'] }),
    false
  )
})
