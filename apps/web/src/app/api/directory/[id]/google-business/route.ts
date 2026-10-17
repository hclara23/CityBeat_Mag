import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { requireGbpListingAccess } from '@/lib/google-business-access'
import { GBP_CONNECTIONS, discoverGbpLocations, fetchGbpLocation, gbpImportPatch, googleAuthorizationUrl, googleOAuthConfigured, refreshGoogleAccessToken, signGbpState } from '@/lib/google-business'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireGbpListingAccess(params.id)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const connection = await adminDb.collection(GBP_CONNECTIONS).doc(params.id).get()
  const data = connection.data() as any
  return NextResponse.json({ configured: googleOAuthConfigured(), connected: connection.exists && data?.status === 'connected', selected_location: data?.selected_location || null, locations: data?.locations || [], last_synced_at: data?.last_synced_at || null, error: data?.last_error || null })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireGbpListingAccess(params.id)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json().catch(() => ({})) as any
  if (body.action === 'connect') {
    if (!googleOAuthConfigured()) return NextResponse.json({ error: 'Google Business Profile OAuth is not configured yet.' }, { status: 503 })
    const locale = body.locale === 'es' ? 'es' : 'en'
    return NextResponse.json({ url: googleAuthorizationUrl(signGbpState({ listingId: params.id, userId: access.user.id, locale })) })
  }
  const ref = adminDb.collection(GBP_CONNECTIONS).doc(params.id)
  const doc = await ref.get()
  const data = doc.data() as any
  if (!doc.exists || !data?.encrypted_refresh_token) return NextResponse.json({ error: 'Connect Google Business Profile first.' }, { status: 409 })
  if (body.action === 'disconnect') {
    await ref.delete()
    await adminDb.collection('directory_audit_log').add({ actor_id: access.user.id, listing_id: params.id, action: 'gbp_disconnect', created_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  }
  const token = await refreshGoogleAccessToken(data.encrypted_refresh_token)
  if (body.action === 'refresh_locations') {
    const locations = await discoverGbpLocations(token)
    await ref.set({ locations, last_discovered_at: new Date().toISOString() }, { merge: true })
    return NextResponse.json({ locations })
  }
  const selected = String(body.location || data.selected_location || '')
  if (!selected || !String(selected).startsWith('locations/')) return NextResponse.json({ error: 'Choose a Google location.' }, { status: 400 })
  const location = await fetchGbpLocation(token, selected)
  if (body.action === 'select' || body.action === 'preview') {
    await ref.set({ selected_location: selected, selected_title: location.title, last_preview_at: new Date().toISOString() }, { merge: true })
    return NextResponse.json({ location, patch: gbpImportPatch(location) })
  }
  if (body.action === 'apply') {
    if (body.confirmed !== true) return NextResponse.json({ error: 'Confirm the reviewed import before applying it.' }, { status: 400 })
    const patch = gbpImportPatch(location)
    await adminDb.runTransaction(async tx => {
      tx.set(access.ref, { ...patch, updated_at: new Date().toISOString(), gbp_last_import_at: new Date().toISOString() }, { merge: true })
      tx.set(ref, { selected_location: selected, selected_title: location.title, last_synced_at: new Date().toISOString(), last_error: null }, { merge: true })
      tx.create(adminDb.collection('directory_audit_log').doc(), { actor_id: access.user.id, listing_id: params.id, action: 'gbp_import_apply', fields: Object.keys(patch), before: { name: access.listing.name || '', address: access.listing.address || '', phone: access.listing.phone || '', website: access.listing.website || '', description: access.listing.description || '', hours: access.listing.hours || {} }, created_at: new Date().toISOString() })
    })
    return NextResponse.json({ ok: true, patch })
  }
  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
