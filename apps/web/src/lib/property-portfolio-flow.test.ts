import test from 'node:test'
import assert from 'node:assert/strict'
import { portfolioHarness } from './property-portfolio-test-harness'
import { PROPERTY_TYPES } from './apartments'
import { resolveListingPatchAccess, resolveEntitlements } from './directory-entitlements'
import { handlePropertyPortfolioEvent } from './property-portfolio-billing'
import { publicRentalFromListing } from './property-rental-public'
import { getPropertyCompany } from './property-companies'

const authority = { action: 'claim', role: 'Regional director', evidence: 'Verify my corporate role with the official management office.', authorized: true }
const review = { kind: 'claim', id: 'rpm-living_corporate', approved: true, authority_checked: true, note: 'Confirmed corporate authority and all listed properties with the company.' }
const newProperty = { name: 'Fixture rental', address: '100 Fixture Lane', city: 'El Paso', state: 'TX', zip: '79901', phone: '9155550199', website: 'https://example.test/rental', property_type: 'single-family', description: 'Fixture rental description.', description_es: 'Descripción de alquiler de prueba.' }
async function approved(company = 'rpm-living') {
  const h = portfolioHarness()
  assert.equal((await h.post(authority, company)).status, 200)
  assert.equal(h.records.has(`property_accounts/${company}`), false)
  h.setStaff(true)
  const response = await h.admin({ ...review, id: `${company}_corporate` })
  assert.equal(response.status, 200, JSON.stringify(await response.json()))
  h.setStaff(false)
  return h
}
async function paid() {
  const h = await approved()
  assert.equal((await h.post({ action: 'checkout', recurring_consent: true, monthly_cents: 9990, locale: 'es' })).status, 200)
  const sub = h.completeCheckout(); await h.event(sub)
  return { h, sub }
}
test('real HTTP routes enforce authentication, verified email, origin, rate limit, and staff authority', async () => {
  const h = portfolioHarness(); h.setUser(null)
  assert.equal((await h.get()).status, 401)
  assert.equal((await h.post(authority)).status, 401)
  h.setUser({ id: 'corporate', email: 'corporate@example.test', email_verified: false })
  assert.equal((await h.post(authority)).status, 403)
  h.setUser({ id: 'corporate', email: 'corporate@example.test', email_verified: true })
  assert.equal((await h.post(authority, 'rpm-living', 'https://attacker.test')).status, 403)
  h.setRate(false); assert.equal((await h.post(authority)).status, 429)
  assert.equal((await h.admin(review)).status, 403)
  assert.equal(h.calls.length, 0)
})
test('corporate claim review grants the whole RPM portfolio, with zero payment calls', async () => {
  const h = await approved(), account = h.records.get('property_accounts/rpm-living')
  assert.equal(account.listing_ids.length, 10)
  for (const id of account.listing_ids) {
    const listing = h.records.get(`directory_listings/${id}`)
    assert.equal(listing.owner_id, 'corporate'); assert.equal(listing.claim_status, 'approved'); assert.equal(listing.tier, 'basic')
  }
  assert.equal(h.calls.length, 0)
  h.setUser({ id: 'other', email_verified: true, email: 'other@example.test' })
  assert.equal((await h.post(authority)).status, 409)
  assert.equal((await (await h.get()).json()).account, null)
})
test('one ownership conflict rejects the entire corporate grant', async () => {
  const h = portfolioHarness()
  await h.post(authority)
  h.records.set('directory_listings/apartment-alza-dwellings', { name: 'ALZA Dwellings', address: '1831 Murchison Drive', phone: '+19152655427', owner_id: 'existing-owner' })
  h.setStaff(true)
  assert.equal((await h.admin(review)).status, 409)
  assert.equal(h.records.has('property_accounts/rpm-living'), false)
  assert.equal([...h.records.values()].filter(x => x.owner_id === 'corporate').length, 0)
  assert.equal(h.records.get('directory_listings/apartment-alza-dwellings').owner_id, 'existing-owner')
})
test('shared company websites and leasing numbers do not collapse distinct Integrity properties', async () => {
  const h = await approved('integrity-asset-management')
  const ids = h.records.get('property_accounts/integrity-asset-management').listing_ids
  assert.equal(ids.length, 59); assert.equal(new Set(ids).size, 59)
  assert.equal(h.records.get('directory_listings/apartment-la-hacienda-at-villa-victoria').city, 'San Elizario')
})
test('concurrent checkout retries create one session with server-derived quantity and fixed monthly price', async () => {
  const h = await approved()
  assert.equal((await h.post({ action: 'checkout', recurring_consent: false, monthly_cents: 9990 })).status, 400)
  assert.equal((await h.post({ action: 'checkout', recurring_consent: true, monthly_cents: 1, quantity: 1 })).status, 400)
  const responses = await Promise.all([h.post({ action: 'checkout', recurring_consent: true, monthly_cents: 9990, quantity: 1, unit_amount: 1, locale: 'es' }), h.post({ action: 'checkout', recurring_consent: true, monthly_cents: 9990, locale: 'es' })])
  for (const response of responses) assert.equal(response.status, 200, JSON.stringify(await response.json()))
  assert.equal(h.sessions.size, 1)
  const session = [...h.sessions.values()][0]
  assert.equal(session.line_items[0].quantity, 10); assert.equal(session.line_items[0].price_data.unit_amount, 999)
  assert.equal(session.locale, 'es'); assert.equal(session.subscription_data.metadata.promo_id, 'property_portfolio_founders')
  assert.equal(h.records.get('directory_listings/apartment-alza-dwellings').tier, 'basic')
  const sub = h.completeCheckout(); await h.event(sub); await h.event(sub)
  assert.equal(h.records.get('directory_listings/apartment-alza-dwellings').tier, 'premium')
  assert.equal((await h.post({ action: 'checkout', recurring_consent: true, monthly_cents: 9990 })).status, 409)
})
test('bulk edits are atomic, scoped to the corporate portfolio, and reject privileged field injection', async () => {
  const { h } = await paid(), id = 'apartment-alza-dwellings', path = `directory_listings/${id}`
  assert.equal((await h.post({ action: 'bulk_edit', listing_ids: [id], changes: { owner_id: 'attacker' } })).status, 400)
  h.records.set('directory_listings/foreign', { name: 'Foreign', owner_id: 'another', claim_status: 'approved' })
  const before = structuredClone(h.records.get(path))
  assert.equal((await h.post({ action: 'bulk_edit', listing_ids: [id, 'foreign'], changes: { phone: '9155550100' } })).status, 403)
  assert.deepEqual(h.records.get(path), before)
  assert.equal((await h.post({ action: 'bulk_edit', listing_ids: [id], changes: { website: 'javascript:alert(1)' } })).status, 400)
  assert.equal((await h.post({ action: 'bulk_edit', listing_ids: [id, 'apartment-ridgemar'], changes: { description: 'Updated leasing information.', description_es: 'Información de alquiler actualizada.' } })).status, 200)
  assert.equal(h.records.get(path).description_es, 'Información de alquiler actualizada.')
})
test('optional manager can edit the assigned listing but cannot bill, bulk-edit, or take corporate control', async () => {
  const { h } = await paid(), id = 'apartment-alza-dwellings'
  assert.equal((await h.post({ action: 'assign_manager', listing_id: id, email: 'missing@example.test' })).status, 400)
  assert.equal((await h.post({ action: 'assign_manager', listing_id: id, email: 'manager@example.test' })).status, 200)
  assert.equal(resolveEntitlements(h.records.get(`directory_listings/${id}`)).additionalManagers, 1)
  assert.equal(resolveEntitlements({ ...h.records.get(`directory_listings/${id}`), tier: 'basic' }).additionalManagers, 0)
  const dashboard = await (await h.get()).json()
  assert.equal(dashboard.account.listings.find((listing: any) => listing.id === id).managers[0].email, 'manager@example.test')
  assert.equal(resolveListingPatchAccess(h.records.get(`directory_listings/${id}`), { userId: 'manager', isStaff: false, managerAllowance: resolveEntitlements(h.records.get(`directory_listings/${id}`)).additionalManagers }).isManager, true)
  assert.equal(resolveListingPatchAccess(h.records.get('directory_listings/apartment-ridgemar'), { userId: 'manager', isStaff: false }).isManager, false)
  h.setUser({ id: 'manager', email_verified: true, email: 'manager@example.test' })
  for (const action of ['portal', 'quote_addition', 'checkout']) assert.equal((await h.post({ action, recurring_consent: true, monthly_cents: 9990 })).status, 403)
  assert.equal((await h.post({ action: 'bulk_edit', listing_ids: [id], changes: { phone: '9155550100' } })).status, 403)
  assert.equal((await h.post({ action: 'assign_manager', listing_id: id, email: '' })).status, 403)
})
test('all eight rental types can be submitted, reviewed, and stay unpublished until paid enrollment', async () => {
  const { h } = await paid()
  for (const [index, type] of Object.keys(PROPERTY_TYPES).entries()) {
    const response = await h.post({ ...newProperty, action: 'new_property', property_type: type, address: `${200 + index} Fixture Lane`, name: `Fixture ${type}` })
    assert.equal(response.status, 200)
    const { id } = await response.json()
    assert.equal(h.records.get(`directory_listings/${id}`).is_published, false)
    assert.equal(h.records.get('property_accounts/rpm-living').listing_ids.includes(id), false)
    h.setStaff(true)
    assert.equal((await h.admin({ ...review, kind: 'property', id })).status, 200)
    h.setStaff(false)
    assert.equal(h.records.get(`directory_listings/${id}`).is_published, false)
    assert.equal(h.records.get('property_accounts/rpm-living').listing_ids.includes(id), true)
  }
  assert.equal((await h.post({ ...newProperty, action: 'new_property', property_type: 'invalid' })).status, 400)
  assert.equal((await h.post({ ...newProperty, action: 'new_property', address: '200 Fixture Lane' })).status, 409)
  const quote = (await (await h.post({ action: 'quote_addition' })).json()).quote
  assert.equal(quote.monthly_cents, 18 * 999); assert.equal(quote.due_cents, 500)
  assert.equal((await h.post({ action: 'enroll', quote_id: quote.id, due_cents: 0, monthly_cents: quote.monthly_cents, recurring_consent: true })).status, 400)
  assert.equal((await h.post({ action: 'enroll', quote_id: quote.id, due_cents: quote.due_cents, monthly_cents: quote.monthly_cents, recurring_consent: true })).status, 200)
  assert.equal([...h.records.values()].filter(x => x.property_custom && x.is_published).length, 0, 'HTTP response alone cannot activate listings')
  await h.event([...h.subs.values()][0])
  assert.equal([...h.records.values()].filter(x => x.property_custom && x.is_published).length, 8)
  assert.equal(h.records.get('property_accounts/rpm-living').billed_listing_ids.length, 18)
  for (const [path, data] of h.records) if (data.property_custom) {
    const property = publicRentalFromListing(path.split('/')[1], data, getPropertyCompany('rpm-living'))!
    assert.ok(property); assert.equal(property.type, data.property_type)
    assert.equal('owner_id' in property, false); assert.equal('manager_ids' in property, false); assert.equal('stripe_subscription_id' in property, false)
    for (const patch of [{ property_portfolio_paid: false }, { property_review: 'pending' }, { is_published: false }, { tier: 'basic' }]) assert.equal(publicRentalFromListing(property.slug, { ...data, ...patch }, getPropertyCompany('rpm-living')), null)
  }
})
test('failed additional-property payment preserves existing paid listings and leaves additions unpublished', async () => {
  const { h } = await paid()
  const { id } = await (await h.post({ ...newProperty, action: 'new_property' })).json()
  h.setStaff(true); await h.admin({ ...review, kind: 'property', id }); h.setStaff(false)
  const { quote } = await (await h.post({ action: 'quote_addition' })).json()
  h.setDecline(true)
  const response = await h.post({ action: 'enroll', quote_id: quote.id, due_cents: quote.due_cents, monthly_cents: quote.monthly_cents, recurring_consent: true })
  assert.equal(response.status, 200); assert.match((await response.json()).url, /^https:\/\/invoice.stripe.com/)
  const sub = [...h.subs.values()][0]; await h.event(sub)
  assert.equal(h.records.get('directory_listings/apartment-alza-dwellings').tier, 'premium')
  assert.equal(h.records.get(`directory_listings/${id}`).is_published, false)
  sub.pending_update = null; sub.items.data[0].quantity = 11; sub.latest_invoice.status = 'paid'
  await h.event(sub)
  assert.equal(h.records.get(`directory_listings/${id}`).is_published, true)
})
test('fresh Stripe state defeats stale active events and enforces cancellation, payment failures, and price mismatch', async () => {
  const { h, sub } = await paid(), id = 'apartment-alza-dwellings'
  const stale = structuredClone(sub)
  sub.status = 'past_due'; await h.event(stale)
  assert.equal(h.records.get(`directory_listings/${id}`).tier, 'basic')
  sub.status = 'active'; sub.latest_invoice.status = 'paid'; await h.event(sub)
  assert.equal(h.records.get(`directory_listings/${id}`).tier, 'premium')
  sub.cancel_at_period_end = true; await h.event(sub)
  assert.equal(h.records.get(`directory_listings/${id}`).tier, 'premium')
  sub.status = 'canceled'; await h.event(stale)
  assert.equal(h.records.get(`directory_listings/${id}`).tier, 'basic')
  sub.status = 'active'; sub.items.data[0].price.unit_amount = 1
  await assert.rejects(() => h.event(sub), /billing_price_mismatch/)
  assert.equal(h.records.get(`directory_listings/${id}`).tier, 'basic')
})
test('billing portal is corporate-only and cannot change subscription price or quantity', async () => {
  const { h } = await paid()
  assert.equal((await h.post({ action: 'portal', locale: 'es' })).status, 200)
  const config = h.calls.find(c => c.method === 'portal.configuration')!.input
  assert.equal(config.features.subscription_update.enabled, false)
  assert.equal(config.features.payment_method_update.enabled, true)
  assert.equal(config.features.subscription_cancel.mode, 'at_period_end')
  assert.equal(h.calls.find(c => c.method === 'portal.session')!.input.locale, 'es')
})

test('unknown checkout outcomes are recovered before any new session is created', async () => {
  const input = { action: 'checkout', recurring_consent: true, monthly_cents: 9990 }
  const h = await approved(); await h.post(input)
  const account = h.records.get('property_accounts/rpm-living')
  account.checkout_attempt.session_id = null; account.checkout_attempt.expires = 0
  assert.equal((await h.post(input)).status, 200)
  assert.equal(h.sessions.size, 1)
  h.completeCheckout()
  assert.equal((await h.post(input)).status, 409)
  assert.equal(h.sessions.size, 1)
  const expired = await approved(); await expired.post(input)
  const previous = [...expired.sessions.values()][0]; previous.status = 'expired'
  const old = expired.records.get('property_accounts/rpm-living').checkout_attempt
  old.session_id = null; old.expires = 0
  const retries = await Promise.all([expired.post(input), expired.post(input)])
  assert.ok(retries.every(response => response.status === 200))
  assert.equal(expired.sessions.size, 2)
})

test('unpaid initial invoices never grant access and retired subscription events cannot revoke a replacement', async () => {
  const h = await approved(), input = { action: 'checkout', recurring_consent: true, monthly_cents: 9990 }
  await h.post(input); const old = h.completeCheckout(); old.latest_invoice.status = 'open'
  await h.event(old)
  assert.equal(h.records.get('directory_listings/apartment-alza-dwellings').tier, 'basic')
  old.status = 'canceled'; await h.event(old)
  assert.equal((await h.post(input)).status, 200)
  const current = h.completeCheckout(); await h.event(current); await h.event(old)
  assert.equal(h.records.get('property_accounts/rpm-living').stripe_subscription_id, current.id)
  assert.equal(h.records.get('directory_listings/apartment-alza-dwellings').tier, 'premium')
})

test('refunds and disputes revoke paid access, while a won dispute restores it', async () => {
  const { h, sub } = await paid(), path = 'directory_listings/apartment-alza-dwellings'
  sub.latest_invoice.charge.refunded = true
  await h.event(sub)
  assert.equal(h.records.get(path).tier, 'basic')
  sub.latest_invoice.charge.refunded = false; sub.latest_invoice.charge.disputed = true
  ;(h.stripe.charges as any).retrieve = async () => ({ invoice: sub.latest_invoice.id, refunded: false, disputed: true })
  await h.event({ charge: 'ch_fixture', status: 'needs_response' }, 'charge.dispute.created')
  assert.equal(h.records.get(path).tier, 'basic')
  await h.event({ charge: 'ch_fixture', status: 'won' }, 'charge.dispute.closed')
  assert.equal(h.records.get(path).tier, 'premium')
  await h.event(sub)
  assert.equal(h.records.get(path).tier, 'premium')
  sub.latest_invoice.charge.refunded = true
  await h.event({ invoice: sub.latest_invoice.id, refunded: true }, 'charge.refunded')
  assert.equal(h.records.get(path).tier, 'basic')
})

test('expired unpaid additions release the quote and preserve the already-paid portfolio', async () => {
  const { h } = await paid()
  const { id } = await (await h.post({ ...newProperty, action: 'new_property' })).json()
  h.setStaff(true); await h.admin({ ...review, kind: 'property', id }); h.setStaff(false)
  const { quote } = await (await h.post({ action: 'quote_addition' })).json()
  h.setDecline(true)
  await h.post({ action: 'enroll', quote_id: quote.id, due_cents: quote.due_cents, monthly_cents: quote.monthly_cents, recurring_consent: true })
  assert.equal((await (await h.get()).json()).account.pending_quote.id, quote.id)
  const sub = [...h.subs.values()][0]; sub.pending_update = null
  await h.event(sub, 'customer.subscription.pending_update_expired')
  assert.equal(h.records.get('property_accounts/rpm-living').pending_enrollment, null)
  assert.equal(h.records.get('directory_listings/apartment-alza-dwellings').tier, 'premium')
  assert.equal(h.records.get(`directory_listings/${id}`).is_published, false)
  assert.equal((await h.post({ action: 'quote_addition' })).status, 200)
})
test('unlisted residential/commercial firms can apply, receive a company portfolio, and add rentals', async () => {
  const h = portfolioHarness()
  const response = await h.register({ ...authority, name: 'Fixture Commercial Management', website: 'https://example.test', phone: '9155550188', region: 'El Paso' })
  assert.equal(response.status, 200)
  const claim = h.records.get('property_company_claims/new_company_corporate')
  assert.equal(h.records.has(`property_companies/${claim.company_id}`), false)
  h.setStaff(true)
  assert.equal((await h.admin({ ...review, id: 'new_company_corporate' })).status, 200)
  h.setStaff(false)
  assert.equal(h.records.get(`property_companies/${claim.company_id}`).name, 'Fixture Commercial Management')
  assert.equal((await h.post({ ...newProperty, action: 'new_property', property_type: 'commercial' }, claim.company_id)).status, 200)
  assert.equal(h.calls.length, 0)
})
test('non-portfolio Stripe events fall through to existing billing handlers', async () => {
  const h = portfolioHarness()
  assert.equal(await handlePropertyPortfolioEvent({ type: 'checkout.session.completed', data: { object: { metadata: { listing_id: 'other' } } } } as any, h.stripe, h.db), false)
})
