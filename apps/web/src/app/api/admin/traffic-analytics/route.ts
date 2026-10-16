import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { emptyProvider, fetchCloudflareAnalytics, fetchGoogleAnalytics, normalizeRange } from '@/lib/traffic-analytics'

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

  const [google, cloudflare] = await Promise.all([fetchGoogleAnalytics(days), fetchCloudflareAnalytics(days)])
  return NextResponse.json({ range_days: days, generated_at: new Date().toISOString(), providers: { google, cloudflare, first_party: firstParty } })
}
