import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { GBP_CONNECTIONS, discoverGbpLocations, encryptGbpToken, exchangeGoogleCode, verifyGbpState } from '@/lib/google-business'
import { requireGbpListingAccess } from '@/lib/google-business-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co').replace(/\/$/, '')
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.redirect(`${base}/en/login?next=dashboard`)
    const url = new URL(request.url)
    if (url.searchParams.get('error')) throw new Error(url.searchParams.get('error_description') || 'Google authorization was canceled')
    const state = verifyGbpState(url.searchParams.get('state') || '')
    if (state.userId !== user.id) throw new Error('This authorization belongs to a different signed-in user')
    const access = await requireGbpListingAccess(state.listingId)
    if ('error' in access || access.user.id !== user.id) throw new Error('You no longer have access to this listing')
    const tokens = await exchangeGoogleCode(url.searchParams.get('code') || '')
    const locations = await discoverGbpLocations(tokens.access_token)
    await adminDb.collection(GBP_CONNECTIONS).doc(state.listingId).set({ listing_id: state.listingId, user_id: user.id, status: 'connected', encrypted_refresh_token: encryptGbpToken(tokens.refresh_token), locations, connected_at: new Date().toISOString(), last_error: null }, { merge: true })
    const suffix = locations.length === 1 ? '&gbp=connected' : '&gbp=choose'
    return NextResponse.redirect(`${base}/${state.locale}/dashboard/listings/${encodeURIComponent(state.listingId)}?section=settings${suffix}`)
  } catch (error: any) {
    return NextResponse.redirect(`${base}/en/dashboard?gbp_error=${encodeURIComponent(error.message || 'Google Business Profile connection failed')}`)
  }
}
