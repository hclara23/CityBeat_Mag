import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGbpPerformance } from './google-business-report'

const series = (dailyMetric: string, value?: string) => ({ dailyMetric, timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 29 }, ...(value === undefined ? {} : { value }) }] } })

test('Google nested series separates impressions and customer actions', () => {
  const report = parseGbpPerformance({ multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [
    series('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', '12'), series('BUSINESS_IMPRESSIONS_MOBILE_MAPS', '8'),
    series('CALL_CLICKS', '3'), series('WEBSITE_CLICKS', '5'), series('BUSINESS_DIRECTION_REQUESTS', '2'),
  ] }] }, 'City Beat Magazine')
  assert.equal(report.totals.views, 20)
  assert.deepEqual(report.actions, { calls: 3, website_clicks: 5, directions: 2 })
  assert.deepEqual(report.trend, [{ date: '2026-10-29', views: 20, visitors: 0 }])
  assert.equal(report.message, 'City Beat Magazine')
})

test('Google omitted zero values and empty periods are valid zero reports', () => {
  const report = parseGbpPerformance({ multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [series('CALL_CLICKS')] }] }, 'CityBeat')
  assert.equal(report.actions?.calls, 0)
  assert.equal(parseGbpPerformance({ multiDailyMetricTimeSeries: [] }, 'CityBeat').totals.views, 0)
})

test('malformed Google response must not look like a successful zero report', () => {
  for (const body of [{}, { error: 'denied' }, { multiDailyMetricTimeSeries: [{}] }, { multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [series('CALL_CLICKS', 'NaN')] }] }]) {
    assert.throws(() => parseGbpPerformance(body, 'CityBeat'))
  }
})
