// Non-charging release checks. Never submits a valid order or signed webhook.
import assert from 'node:assert/strict'
const origin = process.argv[2]
if (!origin?.startsWith('https://')) throw new Error('Usage: node scripts/audit-release-smoke.mjs HTTPS_ORIGIN')
let passed = 0
const contentIssues = []
async function check(path, expected, init) {
  const start = Date.now()
  const response = await fetch(origin + path, { ...init, signal: AbortSignal.timeout(45000) })
  const text = await response.text()
  assert.ok(expected.includes(response.status), `${path}: expected ${expected}, got ${response.status}`)
  assert.ok(!text.includes('Application error: a server-side exception'), path)
  passed++
  console.log(`${init?.method || 'GET'} ${path}: ${response.status} (${Date.now() - start}ms)`)
  return { response, text }
}
for (const path of ['/en', '/es', '/en/directory', '/es/directory', '/en/login', '/en/founders', '/en/ads', '/es/ads', '/en/premium', '/es/premium', '/api/health', '/robots.txt']) {
  await check(path, [200])
}
for (const path of ['/xx', '/xx/directory', '/definitely-not-a-page']) await check(path, [404])
for (const path of ['/api/analytics/dashboard', '/api/admin/analytics-health', '/api/admin/traffic-analytics', '/api/admin/security/revoke', '/api/admin/finance', '/api/sales/me', '/api/admin/fulfillment', '/api/directory/smoke-test/pixel']) await check(path, [401, 403])
for (const path of ['/api/cron/payout-cycle', '/api/cron/reconcile-orders', '/api/cron/claims-aging']) await check(path, [401])
const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
await check('/api/stripe/checkout', [400], post({ type: 'not_a_real_product', productId: 'x' }))
await check('/api/stripe/checkout', [400], post({ type: 'job', productId: 'a/b/c' }))
await check('/api/stripe/webhook', [400], post({ type: 'checkout.session.completed' }))
const payment = await check('/api/health/payments', [200])
const health = JSON.parse(payment.text)
assert.equal(health.can_take_payments, true)
assert.equal(health.detail, null, 'Stripe probe must not be unreachable or failed')
console.log(`Payment probe revision: ${health.revision}`)
const listingId = process.argv[3]
if (listingId) {
  assert.match(listingId, /^[A-Za-z0-9_-]+$/)
  const listing = await check(`/api/directory/${listingId}`, [200])
  const parsed = JSON.parse(listing.text)
  const record = parsed.listing || parsed
  assert.equal(record.is_published, true)
  for (const locale of ['en', 'es']) {
    const page = await check(`/${locale}/directory/${listingId}`, [200])
    assert.ok(page.text.includes(record.name), 'Business identity is rendered')
    assert.ok(page.text.includes('application/ld+json'), 'Business structured data')
    assert.ok(page.text.includes('tel:'), 'Call action is rendered')
    if (page.text.includes(' is a auto repair')) contentIssues.push(`${locale}: incorrect fallback grammar`)
    assert.ok(!page.text.includes('claim_token_hash'), 'Private claim data must not be rendered')
  }
  console.log(`Reference listing: ${record.name}; tier=${record.tier}; phone=${record.phone}`)
}
const pixel = await check('/pixel.js?id=smoke-test&key=12345678901234567890', [200])
assert.ok(pixel.text.includes('citybeatPixel'))
await check('/pixel.js?id=bad/id&key=short', [400])
for (let attempt = 0; attempt < 2; attempt++) {
  const sitemap = await check('/sitemap.xml', [200])
  assert.ok(sitemap.response.headers.get('content-type')?.includes('xml'))
  assert.ok(sitemap.response.headers.get('cache-control')?.includes('s-maxage=3600'))
  assert.ok(sitemap.text.includes('<urlset'))
  const locations = [...sitemap.text.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])
  assert.ok(locations.length > 100, 'Expected populated production sitemap')
  assert.equal(new Set(locations).size, locations.length, 'Duplicate sitemap URLs')
  console.log(`Sitemap: ${locations.length} URLs, ${Buffer.byteLength(sitemap.text)} bytes`)
}
assert.deepEqual(contentIssues, [], 'Listing content checks')
console.log(`PASS: ${passed} release checks; no payment or payout created.`)
