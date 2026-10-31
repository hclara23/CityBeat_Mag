import assert from 'node:assert/strict'
import test from 'node:test'
import type { ProviderReport } from './traffic-analytics'
import { reportViewCount, selectTrafficReport } from './traffic-report-view'

const provider = (source: ProviderReport['source'], status: ProviderReport['status'] = 'ok'): ProviderReport => ({ source, status, totals: { views: 5000, visitors: 0, sessions: 0 }, trend: [], top_pages: [], channels: [], countries: [], devices: [] })
test('automatic selection prefers Google, then Cloudflare, then CityBeat', () => {
  const providers = { google: provider('google'), cloudflare: provider('cloudflare'), first_party: provider('first_party') }
  assert.equal(selectTrafficReport(providers, '').source, 'google')
  providers.google.status = 'unavailable'
  assert.equal(selectTrafficReport(providers, '').source, 'cloudflare')
  providers.cloudflare.status = 'not_configured'
  assert.equal(selectTrafficReport(providers, '').source, 'first_party')
})
test('explicit source selection never substitutes another provider or invented zeros', () => {
  const providers = { google: provider('google'), cloudflare: provider('cloudflare', 'unavailable') }
  assert.deepEqual(selectTrafficReport(providers, 'cloudflare'), { source: 'cloudflare', report: undefined })
  assert.deepEqual(selectTrafficReport({}, 'first_party'), { source: 'first_party', report: undefined })
})
test('capped totals are lower bounds while zero is a legitimate measured value', () => {
  const report = provider('first_party')
  assert.equal(reportViewCount(report, 'en'), '5,000')
  report.limited = true
  assert.equal(reportViewCount(report, 'es'), '5,000+')
  report.limited = false
  report.totals.views = 0
  assert.equal(reportViewCount(report, 'en'), '0')
})
