import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { emptyProvider, fetchCloudflareAnalytics, fetchGoogleAnalytics, normalizeRange } from '@/lib/traffic-analytics'
import { GBP_CONNECTIONS, fetchGbpPerformance, refreshGoogleAccessToken } from '@/lib/google-business'

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
    const snap = await adminDb.collection('analytics_events').where('ts', '>=', since).limit(5000).get()
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
    if (snap.size === 5000) firstParty.message = 'First-party detail is capped at the latest 5,000 events for cost control.'
  } catch {
    firstParty.status = 'unavailable'
    firstParty.message = 'First-party analytics are temporarily unavailable.'
  }

  const business = emptyProvider('google_business', 'not_configured', 'Connect an authorized Google Business Profile to see Search and Maps actions.')
  const [google, cloudflare, connectionSnap] = await Promise.all([fetchGoogleAnalytics(days), fetchCloudflareAnalytics(days), adminDb.collection(GBP_CONNECTIONS).where('status', '==', 'connected').limit(50).get().catch(() => null)])
  if (connectionSnap?.docs.length) {
    try {
      const totals = { views: 0, calls: 0, website_clicks: 0, directions: 0 }
      const daily = new Map<string, number>()
      for (const doc of connectionSnap.docs) {
        const connection = doc.data() as any
        if (!connection.encrypted_refresh_token || !connection.selected_location) continue
        const token = await refreshGoogleAccessToken(connection.encrypted_refresh_token)
        const report = await fetchGbpPerformance(token, connection.selected_location, days)
        for (const series of report.multiDailyMetricTimeSeries || []) {
          const metric = String(series.dailyMetric || '')
          for (const point of series.timeSeries?.datedValues || []) {
            const value = Number(point.value || 0)
            const date = point.date ? `${point.date.year}-${String(point.date.month).padStart(2, '0')}-${String(point.date.day).padStart(2, '0')}` : ''
            if (metric.includes('IMPRESSIONS')) { totals.views += value; if (date) daily.set(date, (daily.get(date) || 0) + value) }
            else if (metric === 'CALL_CLICKS') totals.calls += value
            else if (metric === 'WEBSITE_CLICKS') totals.website_clicks += value
            else if (metric === 'BUSINESS_DIRECTION_REQUESTS') totals.directions += value
          }
        }
      }
      business.status = 'ok'; business.message = `${connectionSnap.docs.length} authorized profile${connectionSnap.docs.length === 1 ? '' : 's'}`
      business.totals.views = totals.views
      business.actions = { calls: totals.calls, website_clicks: totals.website_clicks, directions: totals.directions }
      business.trend = [...daily].sort().map(([date, views]) => ({ date, views, visitors: 0 }))
    } catch (error) {
      console.error('GBP performance report failed:', error)
      business.status = 'unavailable'; business.message = 'Google Business Profile reporting is temporarily unavailable or the connected profile lacks Performance API access.'
    }
  }
  return NextResponse.json({ range_days: days, generated_at: new Date().toISOString(), providers: { google, cloudflare, first_party: firstParty, google_business: business } })
}
