import { BetaAnalyticsDataClient } from '@google-analytics/data'

export type RangeDays = 7 | 30 | 90
export type MetricRow = { label: string; value: number; secondary?: number }
export type TrendPoint = { date: string; views: number; visitors: number }
export type ProviderReport = {
  source: 'google' | 'cloudflare' | 'first_party'
  status: 'ok' | 'not_configured' | 'unavailable'
  message?: string
  totals: { views: number; visitors: number; sessions: number; engagement_rate?: number; average_session_seconds?: number }
  trend: TrendPoint[]
  top_pages: MetricRow[]
  channels: MetricRow[]
  countries: MetricRow[]
  devices: MetricRow[]
}

export function normalizeRange(value: string | null): RangeDays {
  return value === '7' || value === '90' ? Number(value) as RangeDays : 30
}

export function emptyProvider(source: ProviderReport['source'], status: ProviderReport['status'], message?: string): ProviderReport {
  return { source, status, message, totals: { views: 0, visitors: 0, sessions: 0 }, trend: [], top_pages: [], channels: [], countries: [], devices: [] }
}

const n = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0

function rows(report: any, labelIndex = 0, valueIndex = 0, secondaryIndex?: number): MetricRow[] {
  return (report?.rows || []).map((row: any) => ({
    label: row.dimensionValues?.[labelIndex]?.value || 'Unknown',
    value: n(row.metricValues?.[valueIndex]?.value),
    ...(secondaryIndex === undefined ? {} : { secondary: n(row.metricValues?.[secondaryIndex]?.value) }),
  }))
}

export async function fetchGoogleAnalytics(days: RangeDays): Promise<ProviderReport> {
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) return emptyProvider('google', 'not_configured', 'GA4 property reporting is not configured.')
  try {
    const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    const parsed = json ? JSON.parse(json) : null
    const client = parsed
      ? new BetaAnalyticsDataClient({ credentials: { client_email: parsed.client_email, private_key: parsed.private_key } })
      : new BetaAnalyticsDataClient()
    const property = `properties/${propertyId}`
    const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }]
    const [summary, trend, pages, channels, countries, devices] = await Promise.all([
      client.runReport({ property, dateRanges, metrics: [
        { name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'sessions' },
        { name: 'engagementRate' }, { name: 'averageSessionDuration' },
      ]}),
      client.runReport({ property, dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      client.runReport({ property, dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 }),
      client.runReport({ property, dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 }),
      client.runReport({ property, dateRanges, dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8 }),
      client.runReport({ property, dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8 }),
    ])
    const metrics = summary[0].rows?.[0]?.metricValues || []
    return {
      source: 'google', status: 'ok',
      totals: { views: n(metrics[0]?.value), visitors: n(metrics[1]?.value), sessions: n(metrics[2]?.value), engagement_rate: n(metrics[3]?.value), average_session_seconds: n(metrics[4]?.value) },
      trend: (trend[0].rows || []).map((row: any) => ({ date: row.dimensionValues?.[0]?.value || '', views: n(row.metricValues?.[0]?.value), visitors: n(row.metricValues?.[1]?.value) })),
      top_pages: rows(pages[0], 0, 0, 1), channels: rows(channels[0], 0, 0, 1), countries: rows(countries[0]), devices: rows(devices[0]),
    }
  } catch (error: any) {
    console.error('GA4 traffic report failed:', error)
    return emptyProvider('google', 'unavailable', 'Google Analytics reporting is temporarily unavailable or lacks property access.')
  }
}

export async function fetchCloudflareAnalytics(days: RangeDays): Promise<ProviderReport> {
  const token = process.env.CLOUDFLARE_ANALYTICS_API_TOKEN
  const accountTag = process.env.CLOUDFLARE_ACCOUNT_ID
  const siteTag = process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG || process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN
  if (!token || !accountTag || !siteTag) return emptyProvider('cloudflare', 'not_configured', 'Cloudflare read-only reporting credentials are not configured.')
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  const query = `query CityBeatRUM($accountTag: String!, $siteTag: String!, $start: DateTime!, $end: DateTime!) {
    viewer { accounts(filter: { accountTag: $accountTag }) {
      totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $siteTag, datetime_geq: $start, datetime_leq: $end }) { count }
      trend: rumPageloadEventsAdaptiveGroups(limit: 100, filter: { siteTag: $siteTag, datetime_geq: $start, datetime_leq: $end }, orderBy: [datetimeDay_ASC]) { count dimensions { datetimeDay } }
      pages: rumPageloadEventsAdaptiveGroups(limit: 10, filter: { siteTag: $siteTag, datetime_geq: $start, datetime_leq: $end }, orderBy: [count_DESC]) { count dimensions { requestPath } }
      countries: rumPageloadEventsAdaptiveGroups(limit: 8, filter: { siteTag: $siteTag, datetime_geq: $start, datetime_leq: $end }, orderBy: [count_DESC]) { count dimensions { countryName } }
    } }
  }`
  try {
    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { accountTag, siteTag, start: start.toISOString(), end: end.toISOString() } }),
      signal: AbortSignal.timeout(8000), cache: 'no-store',
    })
    const body = await response.json()
    if (!response.ok || body.errors?.length) throw new Error(body.errors?.[0]?.message || `HTTP ${response.status}`)
    const account = body.data?.viewer?.accounts?.[0]
    const map = (items: any[], field: string) => (items || []).map((item) => ({ label: item.dimensions?.[field] || 'Unknown', value: n(item.count) }))
    return {
      source: 'cloudflare', status: 'ok',
      totals: { views: n(account?.totals?.[0]?.count), visitors: 0, sessions: 0 },
      trend: (account?.trend || []).map((item: any) => ({ date: item.dimensions?.datetimeDay || '', views: n(item.count), visitors: 0 })),
      top_pages: map(account?.pages, 'requestPath'), countries: map(account?.countries, 'countryName'), channels: [], devices: [],
    }
  } catch (error: any) {
    console.error('Cloudflare traffic report failed:', error)
    return emptyProvider('cloudflare', 'unavailable', 'Cloudflare reporting is temporarily unavailable or the API schema/credential needs attention.')
  }
}
