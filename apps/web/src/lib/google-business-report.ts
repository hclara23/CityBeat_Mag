import { emptyProvider } from './traffic-analytics'

/** Google's response groups dailyMetricTimeSeries inside multiDailyMetricTimeSeries. */
export function parseGbpPerformance(body: any, title: string) {
  if (!Array.isArray(body?.multiDailyMetricTimeSeries)) throw new Error('Missing Google performance series')
  const report = emptyProvider('google_business', 'ok', title)
  const daily = new Map<string, number>()
  report.actions = { calls: 0, website_clicks: 0, directions: 0 }
  const impressions = new Set(['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'])
  for (const group of body.multiDailyMetricTimeSeries) {
    if (!Array.isArray(group.dailyMetricTimeSeries)) throw new Error('Invalid Google performance series')
    for (const series of group.dailyMetricTimeSeries) {
      for (const point of series.timeSeries?.datedValues || []) {
        const value = Number(point.value ?? 0)
        if (!Number.isFinite(value) || value < 0) throw new Error('Invalid Google performance value')
        if (impressions.has(series.dailyMetric)) {
          report.totals.views += value
          if (point.date) {
            const date = `${point.date.year}-${String(point.date.month).padStart(2, '0')}-${String(point.date.day).padStart(2, '0')}`
            daily.set(date, (daily.get(date) || 0) + value)
          }
        } else if (series.dailyMetric === 'CALL_CLICKS') report.actions.calls += value
        else if (series.dailyMetric === 'WEBSITE_CLICKS') report.actions.website_clicks += value
        else if (series.dailyMetric === 'BUSINESS_DIRECTION_REQUESTS') report.actions.directions += value
      }
    }
  }
  report.trend = [...daily].sort().map(([date, views]) => ({ date, views, visitors: 0 }))
  return report
}
