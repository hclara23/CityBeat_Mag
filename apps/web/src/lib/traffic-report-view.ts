import type { ProviderReport } from './traffic-analytics'

export type TrafficSource = 'google' | 'cloudflare' | 'first_party'
export const TRAFFIC_SOURCES: TrafficSource[] = ['google', 'cloudflare', 'first_party']
export function selectTrafficReport(providers: Partial<Record<TrafficSource, ProviderReport>>, requested: TrafficSource | '') {
  // An explicit choice never silently substitutes another provider.
  const source = requested || TRAFFIC_SOURCES.find(key => providers[key]?.status === 'ok') || 'google'
  return { source, report: providers[source]?.status === 'ok' ? providers[source] : undefined }
}
export function reportViewCount(report: ProviderReport, locale: string) {
  return `${new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US').format(report.totals.views)}${report.limited ? '+' : ''}`
}
