import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function fmt(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}

// Real traffic stats for the admin dashboard.
// Source of truth: Google Analytics 4 when GA4_PROPERTY_ID is configured;
// otherwise our first-party `analytics_events` (logged by /api/track/pageview),
// so the numbers are always real — never mock.
export async function GET() {
  const propertyId = process.env.GA4_PROPERTY_ID

  // ── Google Analytics 4 (preferred when configured) ──────────────────────────
  if (propertyId) {
    try {
      const jsonCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
      const client = jsonCreds
        ? new BetaAnalyticsDataClient({
            credentials: {
              client_email: JSON.parse(jsonCreds).client_email,
              private_key: JSON.parse(jsonCreds).private_key,
            },
          })
        : new BetaAnalyticsDataClient() // Application Default Credentials (Cloud Run SA)

      const [viewsResponse, pagesResponse] = await Promise.all([
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: 'yesterday', endDate: 'today' }],
          metrics: [{ name: 'screenPageViews' }],
        }),
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10,
        }),
      ])

      const totalViews = parseInt(viewsResponse[0].rows?.[0]?.metricValues?.[0]?.value || '0', 10)
      const topStories = (pagesResponse[0].rows || []).slice(0, 5).map((row) => ({
        t: (row.dimensionValues?.[0]?.value || 'Unknown').replace(/\s*[-|]\s*CityBeat.*/i, ''),
        v: fmt(parseInt(row.metricValues?.[0]?.value || '0', 10)),
      }))
      return NextResponse.json({ source: 'ga4', totalViews, topStories })
    } catch (error) {
      console.error('GA4 fetch failed, falling back to first-party:', error)
      // fall through to first-party
    }
  }

  // ── First-party analytics (always real, no external setup) ───────────────────
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const viewsAgg = await adminDb
      .collection('analytics_events')
      .where('ts', '>=', since24h)
      .count()
      .get()
      .then((s: any) => s.data().count)
      .catch(() => 0)

    const recentSnap = await adminDb
      .collection('analytics_events')
      .where('ts', '>=', since30d)
      .limit(5000)
      .get()
      .catch(() => ({ docs: [] as any[] }))

    const counts = new Map<string, number>()
    for (const d of recentSnap.docs as any[]) {
      const p = (d.data() as any).path || '/'
      counts.set(p, (counts.get(p) || 0) + 1)
    }
    const topStories = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, v]) => ({ t: path, v: fmt(v) }))

    return NextResponse.json({ source: 'first_party', totalViews: viewsAgg, topStories })
  } catch (error) {
    console.error('First-party analytics failed:', error)
    return NextResponse.json({ source: 'none', totalViews: 0, topStories: [] })
  }
}
