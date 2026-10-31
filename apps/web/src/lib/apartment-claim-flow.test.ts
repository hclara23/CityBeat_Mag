import test from 'node:test'
import assert from 'node:assert/strict'
import * as consent from './claim-sms-consent'
import { APARTMENT_COMMUNITIES } from './apartments'
import { approvedApartment } from './apartment-listing'
import { resolveListingPatchAccess } from './directory-entitlements'
import { harness } from './apartment-claim-test-harness'

test('every researched apartment record completes the real text verification handlers in both languages', async () => {
  for (const property of APARTMENT_COMMUNITIES) for (const locale of ['en', 'es']) {
    const h = harness()
    const started = await h.apartmentStart({ locale, method: 'email', listingId: 'attacker-id', phone: '+19155550199', requestedContact: '+19155550199' }, property.slug)
    assert.equal(started.status, 200, `${property.slug}/${locale}`)
    assert.equal(h.messages.length, 1)
    assert.equal(h.messages[0].to, `+1${property.phone}`)
    assert.match(h.messages[0].body, /654321/)
    assert.match(h.messages[0].body, locale === 'es' ? /Su codigo solicitado/ : /Your requested listing/)
    assert.match(h.messages[0].body, /STOP/)
    assert.match(h.messages[0].body, /HELP/)
    assert.equal(h.claims()[0].sms_consent.locale, locale)
    assert.equal(h.claims()[0].sms_consent.disclosure, consent.CLAIM_SMS_CONSENT[locale as 'en' | 'es'])
    const result = await h.apartmentVerify({ code: '654321', locale }, property.slug)
    assert.equal(result.status, 200)
    assert.equal((await result.json()).status, 'pending_approval')
    assert.equal(h.records.get(`directory_listings/apartment-${property.slug}`)?.owner_id, 'manager-a')
    assert.equal(h.records.get(`directory_listings/apartment-${property.slug}`)?.claim_status, 'pending_approval')
    assert.equal(h.claims()[0].status, 'verified')
    assert.equal((await h.apartmentVerify({ code: '654321' }, property.slug)).status, 404, 'code replay is refused')
  }
})

test('unauthenticated, missing-consent, stale-consent and rate-limited requests do not send SMS', async () => {
  for (const body of [{ smsConsent: false }, { smsConsent: 'true' }, { smsConsentVersion: 'old' }]) {
    const h = harness(); h.seed()
    assert.equal((await h.start(body)).status, 400)
    assert.equal(h.messages.length, 0); assert.equal(h.claims().length, 0)
  }
  const h = harness(); h.seed(); h.setUser(null)
  assert.equal((await h.start()).status, 401)
  assert.equal((await h.verify()).status, 401)
  h.setUser({ id: 'manager-a' }); h.setRate(false)
  assert.equal((await h.start()).status, 429)
  assert.equal(h.messages.length, 0); assert.equal(h.claims().length, 0)
})

test('provider refusal removes undelivered claim and cannot grant ownership', async () => {
  const h = harness(); h.seed(); h.setSent(false)
  assert.equal((await h.start()).status, 502)
  assert.equal(h.claims().length, 0)
  assert.equal((await h.verify()).status, 404)
  assert.equal(h.records.get('directory_listings/property')?.owner_id, undefined)
})

test('wrong codes consume five attempts and expired codes are invalidated', async () => {
  const h = harness(); h.seed(); await h.start()
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.equal((await h.verify({ code: '000000' })).status, attempt === 5 ? 429 : 400)
  }
  assert.equal(h.claims()[0].attempts, 5)
  assert.equal(h.claims()[0].status, 'failed')
  assert.equal((await h.verify()).status, 404)
  const expired = harness(); expired.seed(); await expired.start(); expired.claims()[0].expires_at = Date.now() - 1
  assert.equal((await expired.verify()).status, 400)
  assert.equal(expired.claims()[0].status, 'expired')
  assert.equal(expired.records.get('directory_listings/property')?.owner_id, undefined)
})

test('a code is bound to its requesting account and cannot overwrite an intervening owner', async () => {
  const h = harness(); h.seed(); await h.start(); h.setUser({ id: 'manager-b' })
  assert.equal((await h.verify()).status, 404)
  h.setUser({ id: 'manager-a' })
  h.records.get('directory_listings/property')!.owner_id = 'manager-b'
  h.records.get('directory_listings/property')!.claim_status = 'approved'
  assert.equal((await h.verify()).status, 409)
  assert.equal(h.records.get('directory_listings/property')?.owner_id, 'manager-b')
})

test('missing, malformed-phone and already-owned properties fail before SMS delivery', async () => {
  const missing = harness(); assert.equal((await missing.start()).status, 404)
  for (const data of [{ phone: '' }, { phone: '123' }, { claim_status: 'approved', owner_id: 'someone-else' }]) {
    const h = harness(); h.seed('property', data)
    assert.equal((await h.start()).status, 400)
    assert.equal(h.messages.length, 0)
  }
})

test('apartment routes require authentication and current consent before creating records', async () => {
  const h = harness(); h.setUser(null)
  assert.equal((await h.apartmentStart()).status, 401)
  assert.equal((await h.apartmentVerify()).status, 401)
  h.setUser({ id: 'manager-a' })
  for (const body of [{ smsConsent: false }, { smsConsent: 'true' }, { smsConsentVersion: 'old' }]) {
    const response = await h.apartmentStart(body)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).errorCode, 'consent_required')
  }
  assert.equal(h.records.size, 0)
  assert.equal(h.messages.length, 0)
  assert.equal((await h.apartmentStart({}, 'not-in-the-catalog')).status, 404)
  assert.equal((await h.apartmentVerify({ code: 'not-six-digits' })).status, 400)
  assert.equal(h.records.size, 0)
})

test('apartment errors expose stable translation keys for refusal, expiry, retry limits and missing claims', async () => {
  const h = harness(); h.setSent(false)
  const failed = await h.apartmentStart({ locale: 'es' })
  assert.equal(failed.status, 502)
  assert.equal((await failed.json()).errorCode, 'send_failed')
  assert.equal(h.claims().length, 0)
  assert.equal((await (await h.apartmentVerify()).json()).errorCode, 'no_active_claim')
  h.setSent(true); await h.apartmentStart({ locale: 'es' })
  assert.equal((await (await h.apartmentVerify({ code: '000000' })).json()).errorCode, 'invalid_code')
  h.claims()[0].expires_at = Date.now() - 1
  assert.equal((await (await h.apartmentVerify()).json()).errorCode, 'expired')
  h.setRate(false)
  assert.equal((await (await h.apartmentStart()).json()).errorCode, 'rate_limited')
  const locked = harness(); await locked.apartmentStart()
  for (let i = 0; i < 4; i++) await locked.apartmentVerify({ code: '000000' })
  assert.equal((await (await locked.apartmentVerify({ code: '000000' })).json()).errorCode, 'too_many_attempts')
})

test('resolver reads do not create records; a repeated claim reuses its one stable mapping', async () => {
  const h = harness()
  assert.equal((await h.resolve('alza-dwellings')).id, 'apartment-alza-dwellings')
  assert.equal(h.records.size, 0)
  await h.apartmentStart(); await h.apartmentStart()
  assert.equal([...h.records.keys()].filter(k => k.startsWith('directory_listings/')).length, 1)
  assert.equal([...h.records.keys()].filter(k => k.startsWith('apartment_listing_links/')).length, 1)
})

test('resolver links existing identity without overwriting contact or billing data', async () => {
  const h = harness()
  const property = APARTMENT_COMMUNITIES[0]
  h.seed('existing-property', { name: property.name, address: property.address, website: property.website,
    phone: '+19155550123', stripe_subscription_id: 'existing-paid-plan', tier: 'premium' })
  const before = { ...h.records.get('directory_listings/existing-property') }
  const response = await h.apartmentStart()
  assert.equal(response.status, 200)
  assert.equal(h.messages[0].to, '+19155550123')
  assert.deepEqual(h.records.get('directory_listings/existing-property'), before)
  assert.equal(h.records.get('apartment_listing_links/alza-dwellings')?.listing_id, 'existing-property')
  assert.equal([...h.records.keys()].filter(k => k.startsWith('directory_listings/')).length, 1)
})

test('ambiguous, conflicting and broken mappings fail closed without SMS or duplicate listings', async () => {
  for (const mode of ['ambiguous', 'identity-conflict', 'broken-map']) {
    const h = harness(); const property = APARTMENT_COMMUNITIES[0]
    if (mode === 'broken-map') h.records.set('apartment_listing_links/alza-dwellings', { listing_id: 'missing' })
    else {
      h.seed('existing-a', { name: property.name, address: mode === 'identity-conflict' ? 'Another address' : property.address, phone: '9155550199' })
      if (mode === 'ambiguous') h.seed('existing-b', { name: property.name, address: property.address })
    }
    const originalSize = h.records.size
    const response = await h.apartmentStart()
    assert.equal(response.status, 503, mode)
    assert.equal((await response.json()).errorCode, 'unavailable')
    assert.equal(h.records.size, originalSize)
    assert.equal(h.messages.length, 0)
  }
})

test('unpublished or owned linked properties cannot start a fresh claim', async () => {
  for (const data of [{ is_published: false }, { owner_id: 'other-owner', claim_status: 'approved' }]) {
    const h = harness(); const property = APARTMENT_COMMUNITIES[0]
    h.seed('existing-property', { name: property.name, address: property.address, ...data })
    const response = await h.apartmentStart()
    assert.equal(response.status, 409)
    assert.equal((await response.json()).errorCode, 'already_claimed')
    assert.equal(h.messages.length, 0)
    assert.equal(h.claims().length, 0)
  }
})

test('verified claims remain uneditable until actual admin approval unlocks the owner dashboard', async () => {
  const h = harness(); await h.apartmentStart(); await h.apartmentVerify()
  const listingId = 'apartment-alza-dwellings'
  const listing = () => h.records.get(`directory_listings/${listingId}`)!
  const actor = { userId: 'manager-a', isStaff: false, managerAllowance: 0 }
  assert.equal(resolveListingPatchAccess(listing(), actor).canManage, false)
  assert.equal((await h.approve(listingId)).status, 200)
  assert.equal(listing().claim_status, 'approved')
  assert.equal(listing().tier, 'basic')
  assert.equal(h.records.get('profiles/manager-a')?.is_advertiser, true)
  assert.equal(resolveListingPatchAccess(listing(), actor).canManage, true)
  assert.equal(resolveListingPatchAccess(listing(), { ...actor, userId: 'another-manager' }).canManage, false)
})

test('public apartment overlays apply only approved owner edits and preserve catalog identity', () => {
  const property = APARTMENT_COMMUNITIES[0]
  const edits = { claim_status: 'pending_approval', owner_id: 'manager', name: 'Updated name', address: 'New street',
    phone: '+1 (915) 555-0100', website: 'https://leasing.example.invalid/',
    description: 'Updated English description', description_es: 'Descripción actualizada',
    slug: 'attacker-slug', zip: '00000', type: 'rental-homes', highlights: { en: ['Untrusted'], es: ['Sin verificar'] } }
  assert.equal(approvedApartment(property, edits), property)
  assert.equal(approvedApartment(property, { ...edits, claim_status: 'approved', is_published: false }), property)
  for (const phone of ['+52 656 555 0100', '123', '']) {
    assert.equal(approvedApartment(property, { ...edits, claim_status: 'approved', phone }).phone, property.phone)
  }
  assert.equal(approvedApartment(property, { ...edits, claim_status: 'approved', owner_id: null }), property)
  const approved = approvedApartment(property, { ...edits, claim_status: 'approved' })
  assert.equal(approved.name, edits.name)
  assert.equal(approved.address, edits.address)
  assert.equal(approved.phone, '9155550100')
  assert.equal(approved.website, edits.website)
  assert.equal(approved.summary.en, edits.description)
  assert.equal(approved.summary.es, edits.description_es)
  assert.equal(approved.slug, property.slug)
  assert.equal(approved.zip, property.zip)
  assert.equal(approved.type, property.type)
  assert.equal(approved.highlights, property.highlights)
  assert.equal(approvedApartment(property, { claim_status: 'approved', owner_id: 'manager', website: 'javascript:alert(1)' }).website, property.website)
})
