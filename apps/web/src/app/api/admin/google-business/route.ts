import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { requireGbpAdminAccess } from '@/lib/google-business-admin-access'
import { GBP_PLATFORM_CONNECTIONS, GBP_PLATFORM_ID, discoverGbpLocations, googleAuthorizationUrl, googleOAuthConfigured, refreshGoogleAccessToken, signGbpState } from '@/lib/google-business'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const access = await requireGbpAdminAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const doc = await adminDb.collection(GBP_PLATFORM_CONNECTIONS).doc(GBP_PLATFORM_ID).get()
  const data = doc.data()
  return NextResponse.json({ configured: googleOAuthConfigured(), connected: data?.status === 'connected', locations: (data?.locations || []).map((l: any) => ({ name: l.name, title: l.title })), selected_location: data?.selected_location || '' })
}

export async function POST(request: NextRequest) {
  const access = await requireGbpAdminAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json().catch(() => ({}))
  const ref = adminDb.collection(GBP_PLATFORM_CONNECTIONS).doc(GBP_PLATFORM_ID)
  if (body.action === 'connect') {
    if (!googleOAuthConfigured()) return NextResponse.json({ error: 'Google API approval and OAuth configuration are required before connecting.' }, { status: 503 })
    return NextResponse.json({ url: googleAuthorizationUrl(signGbpState({ listingId: GBP_PLATFORM_ID, userId: access.user.id, locale: body.locale === 'es' ? 'es' : 'en', purpose: 'platform_analytics' })) })
  }
  if (body.action === 'disconnect') {
    await ref.delete()
    return NextResponse.json({ ok: true })
  }
  if (body.action !== 'select' && body.action !== 'refresh_locations') return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  const data = (await ref.get()).data()
  if (data?.status !== 'connected' || !data.encrypted_refresh_token) return NextResponse.json({ error: 'Connect Google first.' }, { status: 409 })
  try {
    // Selection is restricted to profiles currently accessible to the authorized account.
    const locations = await discoverGbpLocations(await refreshGoogleAccessToken(data.encrypted_refresh_token))
    if (body.action === 'refresh_locations') {
      await ref.set({ locations }, { merge: true })
      return NextResponse.json({ ok: true })
    }
    const selected = locations.find(l => l.name === body.location)
    if (!selected) return NextResponse.json({ error: 'Choose an authorized Google Business Profile.' }, { status: 400 })
    await ref.set({ locations, selected_location: selected.name, selected_title: selected.title, selected_by: access.user.id, selected_at: new Date().toISOString() }, { merge: true })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Google could not load profiles. Check API approval or reconnect your Google account.' }, { status: 502 })
  }
}
