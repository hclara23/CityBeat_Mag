import { randomUUID } from 'crypto'
import type { Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import { APARTMENT_COMMUNITIES, apartmentCompanyId } from './apartments'
import { getPropertyCompany } from './property-companies'
import { resolveApartmentListing } from './apartment-listing'
import { resolveEntitlements } from './directory-entitlements'
import { bulkPropertyPatch, ownsPortfolio, ownsPortfolioListing, rentalInput, requirePortfolio, safePropertyUrl, uniqueIds } from './property-portfolio-policy'

type User = { id: string; email?: string; email_verified?: boolean }
const now = () => new Date().toISOString()
export function propertyPortfolioService(db: Firestore, auth: Auth) {
  const accountRef = (id: string) => db.collection('property_accounts').doc(id)
  const listingRef = (id: string) => db.collection('directory_listings').doc(id)
  const auditRef = () => db.collection('directory_audit_log').doc()
  async function owned(companyId: string, uid: string) {
    const doc = await accountRef(companyId).get()
    const account = { ...doc.data(), id: companyId }
    requirePortfolio(ownsPortfolio(account, uid), 'corporate_access_required', 403)
    return account as Record<string, any>
  }
  async function snapshot(companyId: string, user: User) {
    const doc = await accountRef(companyId).get()
    const data = doc.data()
    const claim = await db.collection('property_company_claims').doc(`${companyId}_${user.id}`).get()
    if (!ownsPortfolio(data, user.id)) return { account: null, claim: claim.exists ? { status: claim.data()?.status, note: claim.data()?.review_note || '' } : null }
    const ids: string[] = data?.all_listing_ids || data?.listing_ids || []
    const snapshots = ids.length ? await db.getAll(...ids.map(listingRef)) : []
    const docs = snapshots.filter(d => d.exists && d.data()?.owner_id === user.id && d.data()?.property_account_id === companyId)
    const managerIds = [...new Set(docs.flatMap(d => (d.data()?.manager_ids || []) as string[]))]
    const managers = new Map<string, { name: string; email: string }>()
    for (let offset = 0; offset < managerIds.length; offset += 100) {
      const found = await auth.getUsers(managerIds.slice(offset, offset + 100).map(uid => ({ uid }))).catch(() => ({ users: [] }))
      for (const manager of found.users) managers.set(manager.uid, { name: manager.displayName || '', email: manager.email || '' })
    }
    return { account: { id: companyId, billing_status: data?.billing_status || 'not_started',
      billed_listing_ids: data?.billed_listing_ids || [], listing_ids: data?.listing_ids || [],
      cancel_at_period_end: data?.cancel_at_period_end === true,
      pending_quote: data?.pending_enrollment ? { id: data.pending_enrollment.id, due_cents: data.pending_enrollment.due_cents,
        monthly_cents: data.pending_enrollment.monthly_cents, expires: data.pending_enrollment.expires,
        added: data.pending_enrollment.ids.length - (data.billed_listing_ids || []).length } : null,
      has_subscription: Boolean(data?.stripe_subscription_id),
      listings: docs.filter(d => d.exists).map(d => { const p = d.data()!; return { id: d.id, name: p.name,
        property_type: p.property_type || 'apartments', address: p.address, city: p.city, state: p.state, zip: p.zip,
        phone: p.phone || '', website: p.website || '', description: p.description || '', description_es: p.description_es || '',
        status: p.property_review || p.claim_status, manager_ids: p.manager_ids || [],
        managers: (p.manager_ids || []).map((id: string) => managers.get(id) || { name: '', email: '' }),
        paid: data?.billed_listing_ids?.includes(d.id) && p.tier === 'premium' } }) }, claim: null }
  }
  async function claim(companyId: string, user: User, input: Record<string, any>) {
    requirePortfolio(getPropertyCompany(companyId) || (await db.collection('property_companies').doc(companyId).get()).data()?.status === 'approved', 'company_not_found', 404)
    requirePortfolio(user.email_verified && user.email, 'verified_email_required', 403)
    requirePortfolio(input.authorized === true, 'authority_confirmation_required', 400)
    const role = String(input.role || '').trim(), evidence = String(input.evidence || '').trim()
    requirePortfolio(role.length >= 2 && role.length <= 120 && evidence.length >= 20 && evidence.length <= 3000, 'claim_details_required', 400)
    const ref = db.collection('property_company_claims').doc(`${companyId}_${user.id}`)
    await db.runTransaction(async tx => {
      const [account, previous] = await Promise.all([tx.get(accountRef(companyId)), tx.get(ref)])
      requirePortfolio(!account.data()?.owner_id || account.data()?.owner_id === user.id, 'company_already_claimed')
      requirePortfolio(previous.data()?.status !== 'approved', 'company_already_claimed')
      tx.set(ref, { company_id: companyId, user_id: user.id, email: user.email, role, evidence,
        authorized: true, status: 'pending', submitted_at: now(),
        property_slugs: APARTMENT_COMMUNITIES.filter(p => apartmentCompanyId(p) === companyId).map(p => p.slug) })
    })
    return { ok: true }
  }
  async function approveClaim(id: string, staff: string, note: string) {
    const ref = db.collection('property_company_claims').doc(id), initial = (await ref.get()).data()
    requirePortfolio(initial?.status === 'pending', 'claim_not_pending')
    const claimant = await auth.getUser(initial.user_id)
    requirePortfolio(claimant.emailVerified && !claimant.disabled && claimant.email?.toLowerCase() === initial.email?.toLowerCase(), 'verified_email_required')
    const company = getPropertyCompany(initial.company_id) || initial.proposed_company
    requirePortfolio(company, 'company_not_found', 404)
    const slugs = APARTMENT_COMMUNITIES.filter(p => apartmentCompanyId(p) === company.id).map(p => p.slug)
    const links = []
    // Identity resolution creates only unowned Basic records. The following
    // transaction grants the entire portfolio together or grants none of it.
    for (const slug of slugs) {
      const linked = await resolveApartmentListing(db, slug, true)
      requirePortfolio(linked, 'invalid_property')
      links.push(linked.id)
    }
    const ids = [...new Set(links)]
    await db.runTransaction(async tx => {
      const [fresh, account, ...docs] = await Promise.all([tx.get(ref), tx.get(accountRef(company.id)), ...ids.map(id => tx.get(listingRef(id)))])
      requirePortfolio(fresh.data()?.status === 'pending' && fresh.data()?.user_id === initial.user_id, 'claim_not_pending')
      requirePortfolio(!account.data()?.owner_id, 'company_already_claimed')
      for (const doc of docs) {
        const listing = doc.data()!
        requirePortfolio(!listing.owner_id || listing.owner_id === initial.user_id, 'property_ownership_conflict')
        requirePortfolio(!listing.stripe_subscription_id && !listing.property_account_id, 'property_billing_conflict')
      }
      const stamp = now()
      for (const doc of docs) tx.set(doc.ref, { owner_id: initial.user_id, claim_status: 'approved', ownership_verified: true,
        property_account_id: company.id, management_company_id: company.id, property_review: 'approved',
        property_type: APARTMENT_COMMUNITIES.find(p => `apartment-${p.slug}` === doc.id || p.slug === doc.data()?.apartment_slug)?.type || 'apartments',
        verification_method: 'staff_reviewed_corporate_authority', verified_at: stamp, updated_at: stamp }, { merge: true })
      tx.create(accountRef(company.id), { owner_id: initial.user_id, company_id: company.id, status: 'approved',
        listing_ids: ids, all_listing_ids: ids, billed_listing_ids: [], billing_status: 'not_started', created_at: stamp, updated_at: stamp })
      if (initial.proposed_company) tx.create(db.collection('property_companies').doc(company.id), { ...initial.proposed_company, status: 'approved', reviewed_at: stamp })
      tx.set(ref, { status: 'approved', reviewed_by: staff, review_note: note, reviewed_at: stamp }, { merge: true })
      tx.set(db.collection('profiles').doc(initial.user_id), { is_advertiser: true }, { merge: true })
      tx.create(auditRef(), { actor_id: staff, company_id: company.id, action: 'approved_corporate_claim', listing_ids: ids, note, created_at: stamp })
    })
    return { ok: true }
  }
  async function addProperty(companyId: string, uid: string, input: Record<string, unknown>) {
    const data = rentalInput(input), id = `rental-${randomUUID()}`
    await db.runTransaction(async tx => {
      const account = (await tx.get(accountRef(companyId))).data()
      requirePortfolio(ownsPortfolio(account, uid), 'corporate_access_required', 403)
      const all: string[] = account!.all_listing_ids || account!.listing_ids || []
      requirePortfolio(all.length < 200, 'portfolio_limit')
      const existing = await Promise.all(all.map(id => tx.get(listingRef(id))))
      const normalized = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      requirePortfolio(!existing.some(doc => normalized(doc.data()?.address) === normalized(data.address) && normalized(doc.data()?.zip) === normalized(data.zip)), 'duplicate_property')
      tx.create(listingRef(id), { ...data, owner_id: uid, claim_status: 'pending', ownership_verified: false,
        property_account_id: companyId, management_company_id: companyId, property_review: 'pending',
        property_custom: true, apartment_slug: id, category: 'Real Estate', tier: 'basic', is_published: false,
        manager_ids: [], created_at: now(), updated_at: now() })
      tx.set(accountRef(companyId), { all_listing_ids: [...all, id], updated_at: now() }, { merge: true })
      tx.create(auditRef(), { actor_id: uid, company_id: companyId, listing_id: id, action: 'submitted_rental_property', created_at: now() })
    })
    return { ok: true, id }
  }
  async function reviewProperty(id: string, staff: string, note: string, approved: boolean) {
    await db.runTransaction(async tx => {
      const doc = await tx.get(listingRef(id)), data = doc.data()
      requirePortfolio(data?.property_custom && data.property_review === 'pending', 'property_not_pending')
      const ref = accountRef(data.property_account_id), account = (await tx.get(ref)).data()
      requirePortfolio(ownsPortfolio(account, data.owner_id) && account?.all_listing_ids?.includes(id), 'property_ownership_conflict')
      tx.set(doc.ref, { property_review: approved ? 'approved' : 'rejected', claim_status: approved ? 'approved' : 'rejected',
        ownership_verified: approved, property_review_note: note, updated_at: now() }, { merge: true })
      if (approved) tx.set(ref, { listing_ids: [...new Set([...(account!.listing_ids || []), id])], updated_at: now() }, { merge: true })
      tx.create(auditRef(), { actor_id: staff, company_id: data.property_account_id, listing_id: id, action: approved ? 'approved_rental_property' : 'rejected_rental_property', note, created_at: now() })
    })
    return { ok: true }
  }
  async function bulkEdit(companyId: string, uid: string, input: Record<string, unknown>) {
    const ids = uniqueIds(input.listing_ids), patch = bulkPropertyPatch(input.changes)
    await db.runTransaction(async tx => {
      const [accountDoc, ...docs] = await Promise.all([tx.get(accountRef(companyId)), ...ids.map(id => tx.get(listingRef(id)))])
      const account = { ...accountDoc.data(), id: companyId }
      requirePortfolio(ownsPortfolio(account, uid), 'corporate_access_required', 403)
      for (const doc of docs) {
        requirePortfolio(ownsPortfolioListing(account, doc.data(), doc.id), 'property_access_required', 403)
        if (Object.keys(patch).some(k => k.startsWith('description'))) requirePortfolio(resolveEntitlements(doc.data()!).enhancedDescription, 'paid_property_required')
      }
      for (const doc of docs) tx.set(doc.ref, { ...patch, updated_at: now() }, { merge: true })
      tx.create(auditRef(), { actor_id: uid, company_id: companyId, listing_ids: ids, action: 'bulk_edited_properties',
        changed_fields: Object.keys(patch), before: docs.map(d => ({ id: d.id, values: Object.fromEntries(Object.keys(patch).map(k => [k, d.data()?.[k] || ''])) })), after: patch, created_at: now() })
    })
    return { ok: true, updated: ids.length }
  }
  async function assign(companyId: string, uid: string, listingId: string, email: string) {
    const manager = email ? await auth.getUserByEmail(email.trim().toLowerCase()).catch(() => null) : null
    requirePortfolio(!email || (manager?.emailVerified && !manager.disabled && manager.uid !== uid), 'manager_needs_verified_account', 400)
    await db.runTransaction(async tx => {
      const [a, doc] = await Promise.all([tx.get(accountRef(companyId)), tx.get(listingRef(listingId))])
      const account = { ...a.data(), id: companyId }
      requirePortfolio(ownsPortfolio(account, uid) && ownsPortfolioListing(account, doc.data(), doc.id), 'corporate_access_required', 403)
      requirePortfolio(!manager || resolveEntitlements(doc.data()!).additionalManagers > 0, 'paid_property_required')
      tx.set(doc.ref, { manager_ids: manager ? [manager.uid] : [], updated_at: now() }, { merge: true })
      tx.create(auditRef(), { actor_id: uid, company_id: companyId, listing_id: listingId, action: 'assigned_property_manager',
        manager_id: manager?.uid || null, created_at: now() })
    })
    return { ok: true }
  }
  async function registerCompany(user: User, input: Record<string, any>) {
    requirePortfolio(user.email_verified && user.email, 'verified_email_required', 403)
    const name = String(input.name || '').trim(), website = String(input.website || '').trim()
    const region = String(input.region || '').trim(), phone = String(input.phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
    const role = String(input.role || '').trim(), evidence = String(input.evidence || '').trim()
    requirePortfolio(name.length >= 2 && name.length <= 160 && website.length <= 500 && safePropertyUrl(website) && region.length >= 2 && region.length <= 100 && /^[2-9]\d{2}[2-9]\d{6}$/.test(phone), 'invalid_company', 400)
    requirePortfolio(input.authorized === true && role.length >= 2 && role.length <= 120 && evidence.length >= 20 && evidence.length <= 3000, 'claim_details_required', 400)
    const ref = db.collection('property_company_claims').doc(`new_company_${user.id}`), id = `firm-${randomUUID().slice(0, 8)}`
    await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data()
      requirePortfolio(!previous || previous.status === 'rejected', 'company_request_exists')
      tx.set(ref, { company_id: id, proposed_company: { id, name, website, region, phone },
        user_id: user.id, email: user.email, role, evidence, authorized: true, property_slugs: [], status: 'pending', submitted_at: now() })
    })
    return { ok: true }
  }
  return { owned, snapshot, claim, approveClaim, addProperty, reviewProperty, bulkEdit, assign, registerCompany }
}
