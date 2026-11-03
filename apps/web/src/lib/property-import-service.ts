import { createHash, randomUUID } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { APARTMENT_COMMUNITIES } from './apartments'
import { ownsPortfolio, ownsPortfolioListing, requirePortfolio, rentalInput, bulkPropertyPatch } from './property-portfolio-policy'
import { resolveEntitlements } from './directory-entitlements'
import { duplicateImportCandidates, importPhotoUrl, type ImportDraft, type PropertyImportFields } from './property-import'

const editable = ['phone', 'website', 'description', 'description_es', 'gallery_urls']
const stamp = () => new Date().toISOString()
const idValid = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(id)
const quota = (value: string | undefined) => /^\d+$/.test(value || '') ? Math.min(Number(value), 1000) : 0
export function propertyImportService(db: Firestore) {
  const accountRef = (id: string) => db.collection('property_accounts').doc(id)
  const listingRef = (id: string) => db.collection('directory_listings').doc(id)
  const receiptRef = (id: string) => db.collection('property_import_drafts').doc(id)
  async function access(company: string, uid: string, target: string) {
    const account = { ...(await accountRef(company).get()).data(), id: company }
    requirePortfolio(ownsPortfolio(account, uid), 'corporate_access_required', 403)
    if (target) {
      requirePortfolio(idValid(target), 'invalid_property', 400)
      requirePortfolio(ownsPortfolioListing(account, (await listingRef(target).get()).data(), target), 'property_access_required', 403)
    }
    return account as Record<string, any>
  }
  async function reserve(company: string, uid: string, kind: 'website' | 'brochure', ai: boolean, env: Record<string, string | undefined> = process.env) {
    const month = stamp().slice(0, 7), ref = db.collection('automation_budgets').doc(`property-import-${month}`)
    await db.runTransaction(async tx => {
      const [a, budget] = await Promise.all([tx.get(accountRef(company)), tx.get(ref)])
      requirePortfolio(ownsPortfolio(a.data(), uid), 'corporate_access_required', 403)
      const used = budget.data() || {}, limit = quota(env.PROPERTY_IMPORT_MONTHLY_REQUEST_LIMIT), aiLimit = quota(env.PROPERTY_IMPORT_MONTHLY_AI_LIMIT)
      requirePortfolio(limit > 0 && (used.requests || 0) < limit, 'import_allowance_reached', 429)
      requirePortfolio(!ai || aiLimit > 0 && (used.ai_requests || 0) < aiLimit, 'import_allowance_reached', 429)
      tx.set(ref, { requests: (used.requests || 0) + 1, ai_requests: (used.ai_requests || 0) + (ai ? 1 : 0),
        website_requests: (used.website_requests || 0) + (kind === 'website' ? 1 : 0), month, updated_at: stamp() }, { merge: true })
    })
  }
  async function candidates(fields: PropertyImportFields, company: string) {
    const a = (await accountRef(company).get()).data(), ids: string[] = a?.all_listing_ids || a?.listing_ids || []
    const own = ids.length ? await db.getAll(...ids.map(listingRef)) : []
    const matches = await Promise.all(['name', 'address'].filter(k => fields[k as keyof PropertyImportFields]).map(k =>
      db.collection('directory_listings').where(k, '==', fields[k as keyof PropertyImportFields]).limit(20).get()))
    requirePortfolio(!matches.some(m => m.size >= 20), 'import_duplicate_review_required', 409)
    const all = [...APARTMENT_COMMUNITIES.map(p => ({ id: `apartment-${p.slug}`, name: p.name, address: p.address, city: p.city || 'El Paso', zip: p.zip })),
      ...own.filter(p => p.exists).map(p => ({ ...p.data(), id: p.id })), ...matches.flatMap(m => m.docs.map(p => ({ ...p.data(), id: p.id })))]
    return [...new Map(duplicateImportCandidates(fields, all).map(p => [p.id, p])).values()]
  }
  async function prepare(company: string, uid: string, target: string, draft: ImportDraft) {
    await access(company, uid, target)
    const current = target ? (await listingRef(target).get()).data() : undefined
    const baseline = target ? Object.fromEntries(editable.map(k => [k, current?.[k] ?? (k === 'gallery_urls' ? [] : '')])) : {}
    const duplicates = (await candidates(draft.fields, company)).filter(p => p.id !== target)
    const id = randomUUID(), expires = Date.now() + 24 * 60 * 60 * 1000
    // Do not retain raw brochure/source text; record bounded facts, provenance and the review snapshot.
    const { text: _text, ...stored } = draft
    await receiptRef(id).set({ ...stored, company, uid, target, baseline, expires, applied: false })
    return { id, draft: stored, source_excerpt: draft.text.slice(0, 12000), baseline, duplicates, expires }
  }
  async function apply(company: string, uid: string, input: Record<string, any>) {
    requirePortfolio(idValid(input.id) && input.reviewed === true, 'import_review_required', 400)
    const initial = (await receiptRef(input.id).get()).data()
    requirePortfolio(initial?.company === company && initial.uid === uid, 'property_access_required', 403)
    const fields = input.fields
    requirePortfolio(fields && typeof fields === 'object' && !Array.isArray(fields), 'invalid_property', 400)
    const target = initial.target as string
    const ids = input.selected_fields
    if (target) requirePortfolio(Array.isArray(ids) && ids.length > 0 && ids.length <= editable.length && ids.every((k: unknown) => typeof k === 'string' && editable.includes(k)), 'invalid_changes', 400)
    const photos: unknown = input.photos || []
    requirePortfolio(Array.isArray(photos) && photos.length <= 15 && photos.every(p => importPhotoUrl(p) && initial.photos.includes(p)), 'invalid_photos', 400)
    requirePortfolio(photos.length === 0 || input.photo_rights === true, 'photo_rights_required', 400)
    const textIds: string[] = target ? ids.filter((k: string) => k !== 'gallery_urls') : []
    const data = target ? (textIds.length ? bulkPropertyPatch(Object.fromEntries(textIds.map(k => [k, fields[k]]))) : {}) : rentalInput(fields)
    requirePortfolio(target || data.description && data.description_es, 'bilingual_descriptions_required', 400)
    // A new receipt cannot quietly copy an existing static or dynamic listing.
    if (!target) requirePortfolio((await candidates(data as PropertyImportFields, company)).length === 0, 'duplicate_property', 409)
    const newId = target || `rental-${randomUUID()}`
    await db.runTransaction(async tx => {
      const identity = createHash('sha256').update([data.address, data.city, data.state].map(v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')).join('|')).digest('hex')
      const identityRef = db.collection('property_import_identities').doc(identity)
      const [a, receipt, existing, identityDoc] = await Promise.all([tx.get(accountRef(company)), tx.get(receiptRef(input.id)), tx.get(listingRef(newId)), ...(!target ? [tx.get(identityRef)] : [])])
      const account = { ...a.data(), id: company }, record = receipt.data()
      requirePortfolio(ownsPortfolio(account, uid), 'corporate_access_required', 403)
      requirePortfolio(record?.company === company && record.uid === uid && !record.applied && record.expires > Date.now(), 'import_draft_expired', 409)
      const current = existing.data(), all: string[] = a.data()?.all_listing_ids || a.data()?.listing_ids || []
      let patch: Record<string, unknown> = { ...data }
      if (target) {
        requirePortfolio(ownsPortfolioListing(account, current, target), 'property_access_required', 403)
        for (const key of ids) requirePortfolio(JSON.stringify(current?.[key] ?? (key === 'gallery_urls' ? [] : '')) === JSON.stringify(record.baseline[key]), 'import_listing_changed', 409)
        if (ids.some((k: string) => k.startsWith('description') || k === 'gallery_urls')) requirePortfolio(resolveEntitlements(current!).enhancedDescription, 'paid_property_required')
        if (ids.includes('gallery_urls')) {
          requirePortfolio(photos.length > 0 && photos.length <= resolveEntitlements(current!).mediaLimit, 'invalid_photos', 400)
          patch.gallery_urls = photos
        }
      } else {
        requirePortfolio(all.length < 200, 'portfolio_limit')
        requirePortfolio(!identityDoc?.exists, 'duplicate_property')
        // Account transaction serializes concurrent new imports; recheck own duplicates after every retry.
        const existingPortfolio = all.length ? await Promise.all(all.map(id => tx.get(listingRef(id)))) : []
        requirePortfolio(duplicateImportCandidates(data as PropertyImportFields, existingPortfolio.map(d => ({ ...d.data(), id: d.id }))).length === 0, 'duplicate_property')
        patch = { ...patch, gallery_urls: photos, owner_id: uid, claim_status: 'pending', ownership_verified: false,
          property_account_id: company, management_company_id: company, property_review: 'pending', property_custom: true,
          apartment_slug: newId, category: 'Real Estate', tier: 'basic', is_published: false, manager_ids: [], created_at: stamp() }
      }
      if (photos.length > 0 && (!target || ids.includes('gallery_urls'))) {
        patch.property_gallery_source = record.source.kind === 'website' ? record.source.label : data.website || ''
        patch.property_gallery_reviewed_at = stamp()
      }
      patch.updated_at = stamp()
      if (target) tx.set(listingRef(newId), patch, { merge: true }); else {
        tx.create(listingRef(newId), patch)
        tx.create(identityRef, { listing_id: newId, company_id: company, created_at: stamp() })
        tx.set(accountRef(company), { all_listing_ids: [...all, newId], updated_at: stamp() }, { merge: true })
      }
      tx.set(receipt.ref, { applied: true, applied_at: stamp(), listing_id: newId }, { merge: true })
      tx.create(db.collection('directory_audit_log').doc(), { actor_id: uid, company_id: company, listing_id: newId,
        action: target ? 'reviewed_property_import_update' : 'reviewed_property_import_create', source: record.source,
        generation: record.generation, changed_fields: target ? ids : Object.keys(data), photo_rights: input.photo_rights === true,
        before: target ? record.baseline : {}, after: patch, created_at: stamp() })
    })
    return { ok: true, id: newId }
  }
  return { access, reserve, prepare, apply }
}
