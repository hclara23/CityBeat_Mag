import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { translateTexts } from '@/lib/translate'
import { isSalesCreatedDirectoryListing } from '@/lib/sales-directory'
import { hasEditorAccess } from '@citybeat/lib/roles'
import {
  resolveEntitlements,
  filterEntitledListingUpdate,
  resolveListingPatchAccess,
  isStaffOverrideWrite,
} from '@/lib/directory-entitlements'
import { stripInternalListingFields } from '@/lib/listing-fields'
import {
  ACTION_LINK_KEYS,
  CONTENT_FIELD_SANITIZERS,
  SOCIAL_LINK_KEYS,
  activePosts,
  capText,
  elPasoDayKey,
  sanitizeActionLinks,
  sanitizeHoursRecord,
  sanitizeHttpUrl,
  sanitizeSocialLinks,
} from '@/lib/listing-content'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

function maskClaimContact(value: unknown, type: 'email' | 'phone'): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  if (type === 'email') {
    const [local, domain] = normalized.split('@')
    if (!local || !domain) return null
    return `${local.slice(0, 1)}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`
  }
  const digits = normalized.replace(/\D/g, '')
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null
}

function serializeListing(id: string, data: any) {
  const listing: Record<string, any> = {
    id,
    ...data,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
    sales_created_listing: isSalesCreatedDirectoryListing(data),
    claim_contact_email_hint: maskClaimContact(data.email || data.contact_email, 'email'),
    claim_contact_phone_hint: maskClaimContact(data.phone, 'phone'),
    // Only currently-active posts are public — scheduled/expired offers stay
    // private until they go live.
    posts: activePosts(data.posts, elPasoDayKey(new Date())),
  }
  return stripInternalListingFields(listing)
}

// Expand a sanitized map to a merge-safe write: known keys absent from the
// sanitized object become FieldValue.delete() so clearing a link actually
// persists (merge:true would otherwise keep the stale value).
function mapWithDeletes(sanitized: Record<string, string>, allKeys: readonly string[]) {
  const out: Record<string, unknown> = { ...sanitized }
  for (const key of allKeys) if (!(key in sanitized)) out[key] = FieldValue.delete()
  return out
}

// GET: Fetch single listing details
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  try {
    const doc = await adminDb.collection('directory_listings').doc(id).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    return NextResponse.json({ listing: serializeListing(doc.id, doc.data()) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH: Update fields by approved owner or admin/editor
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getServerUserProfile(user.id)
  const isEditor = hasEditorAccess(profile)

  const ref = adminDb.collection('directory_listings').doc(id)
  const doc = await ref.get()
  if (!doc.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  const listing = doc.data() as any

  // Resolve entitlements first: manager access depends on the plan still
  // including manager seats (additionalManagers).
  const entitlements = resolveEntitlements(listing)
  const { isOwner, canManage } = resolveListingPatchAccess(listing, {
    userId: user.id,
    isStaff: isEditor,
    managerAllowance: entitlements.additionalManagers,
  })
  if (!canManage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Accept only a well-formed JSON object body; anything else is a 400, never an
  // unhandled 500.
  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Server-side entitlement enforcement — the single source of truth for what an
  // owner may write is the central registry, never the (easily bypassed) UI. A
  // strict allow-list lets core fields through for any owner and paid fields only
  // when the listing's activated tier entitles them; editors/developers override
  // the paid gate (a role-checked staff action, audited below).
  const { updates: allowedUpdates } = filterEntitledListingUpdate(body, {
    entitlements,
    isStaff: isEditor,
  })
  // --- Field hardening: nothing reaches Firestore (or the public page) as raw
  // client JSON. Runs on whatever the entitlement filter already admitted. ---

  // URL fields: http(s) only (blocks stored javascript:/data: XSS in the anchors
  // the public page renders). Empty/invalid clears the field.
  if ('website' in allowedUpdates) allowedUpdates.website = sanitizeHttpUrl(allowedUpdates.website) || ''
  if ('image_url' in allowedUpdates) allowedUpdates.image_url = sanitizeHttpUrl(allowedUpdates.image_url) || ''
  if ('gallery_urls' in allowedUpdates) {
    allowedUpdates.gallery_urls = Array.isArray(allowedUpdates.gallery_urls)
      ? allowedUpdates.gallery_urls.map((u: unknown) => sanitizeHttpUrl(u)).filter(Boolean)
      : []
  }
  // Core text fields: trimmed + length-capped (no arbitrary/oversized JSON).
  // GMB-parity fields.
  if ('video_url' in allowedUpdates) allowedUpdates.video_url = sanitizeHttpUrl(allowedUpdates.video_url) || ''
  if ('secondary_categories' in allowedUpdates) {
    allowedUpdates.secondary_categories = Array.isArray(allowedUpdates.secondary_categories)
      ? allowedUpdates.secondary_categories
          .map((c: unknown) => capText(c, 60))
          .filter(Boolean)
          .slice(0, 9) // GBP allows up to 9 additional categories
      : []
  }
  if ('service_areas' in allowedUpdates) {
    allowedUpdates.service_areas = Array.isArray(allowedUpdates.service_areas)
      ? allowedUpdates.service_areas
          .map((a: unknown) => capText(a, 80))
          .filter(Boolean)
          .slice(0, 20)
      : []
  }
  if ('name' in allowedUpdates) allowedUpdates.name = capText(allowedUpdates.name, 140)
  if ('phone' in allowedUpdates) allowedUpdates.phone = capText(allowedUpdates.phone, 40)
  if ('address' in allowedUpdates) allowedUpdates.address = capText(allowedUpdates.address, 200)
  if ('category' in allowedUpdates) allowedUpdates.category = capText(allowedUpdates.category, 80)
  if ('hours' in allowedUpdates) allowedUpdates.hours = sanitizeHoursRecord(allowedUpdates.hours)

  // Map-shaped fields: sanitize valid keys, and persist deletes for cleared keys
  // (a removed booking/social link must actually disappear).
  if ('social_links' in allowedUpdates) {
    allowedUpdates.social_links = mapWithDeletes(sanitizeSocialLinks(allowedUpdates.social_links), SOCIAL_LINK_KEYS)
  }
  if ('action_links' in allowedUpdates) {
    allowedUpdates.action_links = mapWithDeletes(sanitizeActionLinks(allowedUpdates.action_links), ACTION_LINK_KEYS)
  }
  // Array/plain structured content modules.
  for (const [field, sanitize] of Object.entries(CONTENT_FIELD_SANITIZERS)) {
    if (field in allowedUpdates) allowedUpdates[field] = sanitize(allowedUpdates[field])
  }
  // The user-supplied fields actually admitted (before derived/stamped fields) —
  // used for the staff-override audit trail.
  const writtenFields = Object.keys(allowedUpdates)
  // Keep the Spanish description in sync so ES visitors (the majority of El Paso)
  // read real Spanish, not English. Best-effort — never blocks the save.
  if ('description' in allowedUpdates) {
    const desc = String(allowedUpdates.description || '').trim()
    if (desc) {
      const tr = await translateTexts([desc]).catch(() => null)
      if (tr && tr[0]) allowedUpdates.description_es = tr[0]
    } else {
      allowedUpdates.description_es = ''
    }
  }

  allowedUpdates.updated_at = new Date().toISOString()

  try {
    await ref.set(allowedUpdates, { merge: true })

    // Accountability: record staff (editor/developer) overrides — an edit to a
    // listing the actor does not own, or a paid field written past the tier gate.
    // Best-effort; a failed audit write must never break the owner-facing save.
    if (isStaffOverrideWrite({ isStaff: isEditor, isOwner, entitlements, writtenFields })) {
      void adminDb
        .collection('directory_audit_log')
        .add({
          actor_id: user.id,
          listing_id: id,
          action: 'staff_listing_edit',
          fields: writtenFields,
          is_owner: isOwner,
          created_at: new Date().toISOString(),
        })
        .catch(() => {})
    }

    const updated = await ref.get()
    return NextResponse.json({ listing: serializeListing(updated.id, updated.data()) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
