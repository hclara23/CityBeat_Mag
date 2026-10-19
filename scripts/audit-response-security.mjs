// Read-only smoke test against an already-running production build.
import assert from 'node:assert/strict'
const base = process.argv[2] || 'http://localhost:3100'
const canonicalBase = process.argv[3] || 'https://citybeatmag.co'
const nonces = new Set()
for (const path of ['/en/ads', '/es/ads', '/en/premium', '/es/premium']) {
  const response = await fetch(base + path, { headers: { 'x-nonce': 'attacker-controlled' } })
  assert.equal(response.status, 200, path)
  const html = await response.text()
  const policy = response.headers.get('content-security-policy') || ''
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1]
  assert.ok(nonce && nonce !== 'attacker-controlled', 'nonce must be generated server-side')
  assert.ok(!nonces.has(nonce), 'nonce must be fresh per response')
  nonces.add(nonce)
  const scripts = policy.split('; ').find(x => x.startsWith('script-src ')) || ''
  assert.ok(!scripts.includes('unsafe-inline') && !scripts.includes('unsafe-eval'))
  for (const tag of html.match(/<script\b[^>]*>/g) || []) {
    if (tag.includes('application/ld+json')) continue
    assert.ok(tag.includes(`nonce="${nonce}"`), `missing nonce: ${tag}`)
  }
  assert.ok(html.includes(`rel="canonical" href="${canonicalBase}${path}"`), 'canonical')
  assert.ok(html.includes('hrefLang="en"') || html.includes('hreflang="en"'), 'English alternate')
  assert.ok(html.includes('hrefLang="es"') || html.includes('hreflang="es"'), 'Spanish alternate')
  assert.ok(response.headers.get('cache-control')?.includes('no-store'))
  console.log(`${path}: HTTP 200, canonical/hreflang, fresh nonce, hydration scripts authorized, no-store`)
}
