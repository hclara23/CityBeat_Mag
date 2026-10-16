import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { normalizeLeadStatus, LEAD_STATUSES } from '@/lib/premium-value'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!LEAD_STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  const leadRef = adminDb.collection('quote_requests').doc(params.id)
  const leadDoc = await leadRef.get()
  if (!leadDoc.exists) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  const listingId = String(leadDoc.data()?.listing_id || '')
  const listingDoc = await adminDb.collection('directory_listings').doc(listingId).get()
  if (!listingDoc.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  const listing = listingDoc.data() as Record<string, unknown>
  const profile = await getServerUserProfile(user.id)
  const entitlements = resolveEntitlements(listing)
  const access = resolveListingPatchAccess(listing, { userId: user.id, isStaff: hasEditorAccess(profile), managerAllowance: entitlements.additionalManagers })
  if (!access.canManage || !entitlements.detailedLeads) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const status = normalizeLeadStatus(body.status)
  await leadRef.set({ owner_status: status, owner_status_updated_at: new Date().toISOString(), owner_status_updated_by: user.id }, { merge: true })
  return NextResponse.json({ ok: true, status })
}
