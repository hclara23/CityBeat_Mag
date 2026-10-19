// Read-only public release checks; never creates accounts, leads or payments.
import assert from 'node:assert/strict'
const origin = process.argv[2]
assert.match(origin || '', /^https:\/\//)
async function get(path) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(60000) })
  assert.equal(response.status, 200, path)
  return response.text()
}
const first = JSON.parse(await get('/api/directory?page=0'))
const second = JSON.parse(await get('/api/directory?page=1'))
assert.equal(first.listings.length, 24)
assert.equal(first.hasMore, true)
assert.ok(second.listings.length > 0)
assert.ok(second.listings.every(row => !first.listings.some(prior => prior.id === row.id)))
assert.ok(first.total > first.listings.length)
const search = JSON.parse(await get('/api/directory?query=Super%20H'))
assert.ok(search.listings.some(row => row.id === 'TJmwyo55waiFiGYp2fmu'))
const category = JSON.parse(await get('/api/directory?query=auto%20repair'))
assert.ok(category.listings.some(row => row.id === 'TJmwyo55waiFiGYp2fmu'), 'category text matches Super H')
for (const locale of ['en', 'es']) {
  const basic = await get(`/${locale}/directory/0cbe8a5c-3294-479c-8f2c-cf5fb098642f`)
  assert.ok(basic.includes('id="reviews"'), 'Basic review QR destination')
  const premium = await get(`/${locale}/directory/TJmwyo55waiFiGYp2fmu`)
  assert.ok(premium.includes('id="reviews"'))
  assert.ok(premium.includes('tel:'))
  const claim = await get(`/${locale}/directory/0cbe8a5c-3294-479c-8f2c-cf5fb098642f/claim`)
  assert.ok(!claim.includes('$99/yr'), 'anonymous free claim has no paid annual summary')
  const ads = await get(`/${locale}/ads`)
  assert.ok(!ads.includes('50,000+'))
}
const event = await get('/en/events/tm-vvG1YZ_1752rGP')
assert.match(event, /October 18.*8:00 PM MDT/)
console.log('Customer-experience release checks passed: pagination, category/name search, Basic/Premium reviews, contact, free claim, audience copy, venue time.')
