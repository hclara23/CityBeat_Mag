import { NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  const denial = privilegedDenial(profile, hasAdminAccess(profile))
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const firstParty24h = await adminDb.collection('analytics_events').where('ts', '>=', since).count().get()
    .then((s: any) => Number(s.data().count) || 0)
    .catch(() => null)

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    google_analytics: {
      measurement_id: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null,
      collection_enabled: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
      reporting_api_configured: Boolean(process.env.GA4_PROPERTY_ID),
    },
    cloudflare: {
      dns_provider: true,
      traffic_proxied: false,
      beacon_configured: Boolean(process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN),
      reporting_api_configured: Boolean(process.env.CLOUDFLARE_ANALYTICS_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG),
      note: 'citybeatmag.co resolves directly to Google hosting; Cloudflare Web Analytics requires its free beacon token unless proxying is enabled.',
    },
    first_party: { enabled: true, status: firstParty24h === null ? 'unavailable' : 'ok', pageviews_24h: firstParty24h },
    listing_analytics: { enabled: true, aggregate_only: true },
    premium_pixel: { enabled: true, aggregate_only: true, cookies: false },
  })
}
