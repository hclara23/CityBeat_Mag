import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyProvider, fetchCloudflareAnalytics, normalizeRange } from './traffic-analytics'

test('traffic range accepts only supported windows', () => {
  assert.equal(normalizeRange('7'), 7)
  assert.equal(normalizeRange('90'), 90)
  assert.equal(normalizeRange('365'), 30)
  assert.equal(normalizeRange(null), 30)
})

test('provider failures are explicit and contain no invented metrics', () => {
  const report = emptyProvider('cloudflare', 'not_configured', 'missing')
  assert.equal(report.status, 'not_configured')
  assert.deepEqual(report.totals, { views: 0, visitors: 0, sessions: 0 })
  assert.deepEqual(report.trend, [])
})

test('Cloudflare maps the live date schema for every supported reporting range', async (t) => {
  const keys = ['CLOUDFLARE_ANALYTICS_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_WEB_ANALYTICS_SITE_TAG']
  const prior = keys.map(key => process.env[key])
  keys.forEach(key => { process.env[key] = 'test-value' })
  t.after(() => keys.forEach((key, i) => {
    if (prior[i] === undefined) delete process.env[key]
    else process.env[key] = prior[i]
  }))
  let expectedDays = 7
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const { query, variables } = JSON.parse(String(init.body))
    // Cloudflare's live schema accepts date, not datetimeDay.
    assert.match(query, /orderBy: \[date_ASC\]/)
    assert.doesNotMatch(query, /datetimeDay/)
    assert.equal(variables.siteTag, 'test-value')
    const start = new Date(variables.start)
    const end = new Date(variables.end)
    assert.equal(start.getUTCHours(), 0)
    end.setUTCHours(0, 0, 0, 0)
    assert.equal((end.getTime() - start.getTime()) / 86400000, expectedDays - 1)
    return new Response(JSON.stringify({ data: { viewer: { accounts: [{
      totals: [{ count: 42 }],
      trend: [{ count: 42, dimensions: { date: '2026-10-30' } }],
      pages: [{ count: 30, dimensions: { requestPath: '/en/directory' } }],
      countries: [{ count: 42, dimensions: { countryName: 'United States' } }],
    }] } } }))
  })
  for (const days of [7, 30, 90] as const) {
    expectedDays = days
    const report = await fetchCloudflareAnalytics(days)
    assert.equal(report.status, 'ok')
    assert.equal(report.totals.views, 42)
    assert.deepEqual(report.trend, [{ date: '2026-10-30', views: 42, visitors: 0 }])
    assert.deepEqual(report.top_pages, [{ label: '/en/directory', value: 30 }])
  }
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ errors: [{ message: 'Permission denied' }] })))
  t.mock.method(console, 'error', () => {})
  assert.equal((await fetchCloudflareAnalytics(7)).status, 'unavailable')
})
