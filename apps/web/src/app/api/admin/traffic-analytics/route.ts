import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { emptyProvider, fetchCloudflareAnalytics, fetchGoogleAnalytics, normalizeRange } from '@/lib/traffic-analytics'
import { GBP_PLATFORM_CONNECTIONS, GBP_PLATFORM_ID, fetchGbpPerformance, refreshGoogleAccessToken } from '@/lib/google-business'
import { parseGbpPerformance } from '@/lib/google-business-report'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  const denial = privilegedDenial(profile, hasAdminAccess(profile))
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status })

  const days = normalizeRange(new URL(request.url).searchParams.get('days'))
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString()
  const firstParty = emptyProvider('first_party', 'ok')
  try {
    const snap = await adminDb.collection('analytics_events').where('ts', '>=', since).orderBy('ts', 'desc').limit(5000).get()
    const paths = new Map<string, number>()
    const dates = new Map<string, number>()
    for (const doc of snap.docs) {
      const row = doc.data() as any
      const path = String(row.path || '/')
      const date = String(row.ts || '').slice(0, 10)
      paths.set(path, (paths.get(path) || 0) + 1)
      if (date) dates.set(date, (dates.get(date) || 0) + 1)
    }
    firstParty.totals.views = snap.size
    firstParty.trend = [...dates].sort().map(([date, views]) => ({ date, views, visitors: 0 }))
    firstParty.top_pages = [...paths].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }))
    firstParty.limited = snap.size === 5000
    if (firstParty.limited) firstParty.message = 'First-party detail is capped at the latest 5,000 events for cost control.'
  } catch {
    firstParty.status = 'unavailable'
    firstParty.message = 'First-party analytics are temporarily unavailable.'
  }

  let business = emptyProvider('google_business', 'not_configured', 'Connect CityBeat’s own Google Business Profile below for Search and Maps performance. The GA4 product link is managed separately in Google Analytics.')
  const [google, cloudflare, connection] = await Promise.all([
    fetchGoogleAnalytics(days), fetchCloudflareAnalytics(days),
    adminDb.collection(GBP_PLATFORM_CONNECTIONS).doc(GBP_PLATFORM_ID).get().catch(() => null),
  ])
  if (!connection) {
    business = emptyProvider('google_business', 'unavailable', 'The saved Google Business Profile connection could not be read.')
  } else {
    const saved = connection.data()
    if (saved?.status === 'connected' && saved.encrypted_refresh_token && saved.selected_location) {
      try {
        const token = await refreshGoogleAccessToken(saved.encrypted_refresh_token)
        business = parseGbpPerformance(await fetchGbpPerformance(token, saved.selected_location, days), saved.selected_title || 'CityBeat Business Profile')
      } catch (error) {
        console.error('GBP performance report failed:', error)
        business = emptyProvider('google_business', 'unavailable', 'Google Business Profile reporting is unavailable. Check Performance API approval or reconnect the selected profile.')
      }
    } else if (saved?.status === 'connected') {
      business.message = 'Google is connected. Select City Beat Magazine below to enable its performance report.'
    }
  }
  return NextResponse.json({ range_days: days, generated_at: new Date().toISOString(), providers: { google, cloudflare, first_party: firstParty, google_business: business } })
}
