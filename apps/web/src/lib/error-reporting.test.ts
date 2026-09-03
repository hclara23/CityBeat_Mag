import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifySeverity,
  fingerprintError,
  normalizeErrorInput,
  normalizeErrorMessage,
  shouldIgnoreError,
  topAppFrame,
} from './error-reporting'

test('known noise is filtered before it can bury real bugs', () => {
  assert.equal(shouldIgnoreError('ResizeObserver loop completed with undelivered notifications.'), true)
  assert.equal(shouldIgnoreError('Script error.'), true)
  // The error boundary already auto-recovers from these.
  assert.equal(shouldIgnoreError('ChunkLoadError: Loading chunk 772 failed.'), true)
  assert.equal(shouldIgnoreError('NetworkError when attempting to fetch resource.'), true)
  assert.equal(shouldIgnoreError('AbortError: The operation was aborted'), true)
  assert.equal(shouldIgnoreError('boom', 'at f (chrome-extension://abc/inject.js:1:1)'), true)
  assert.equal(shouldIgnoreError(''), true)
  assert.equal(shouldIgnoreError('   '), true)
  // A real bug survives.
  assert.equal(shouldIgnoreError("Cannot read properties of undefined (reading 'total')"), false)
})

test('per-occurrence noise is normalized away so one bug is one row', () => {
  const a = normalizeErrorMessage('Order abc123def4567890 failed after 3 retries at https://x.co/api/v1?id=9')
  const b = normalizeErrorMessage('Order 99887766aabbccdd failed after 12 retries at https://x.co/api/v1?id=44')
  assert.equal(a, b, `\n${a}\n${b}`)
  // Quoted values vary per user and must not split the group.
  assert.equal(
    normalizeErrorMessage('Invalid listing "Tacos El Rey"'),
    normalizeErrorMessage('Invalid listing "Chuco Coffee"')
  )
  // Genuinely different errors stay different.
  assert.notEqual(normalizeErrorMessage('cannot read x'), normalizeErrorMessage('cannot read y'))
})

test('the top APP stack frame is picked, skipping vendor noise', () => {
  const stack = [
    'TypeError: x is not a function',
    '    at div (node_modules/react-dom/cjs/react-dom.js:1:2)',
    '    at Object.next (webpack-internal:///./node_modules/next/dist/x.js:5:6)',
    '    at CartDrawer (src/components/citybeat/CartDrawer.tsx:88:12)',
    '    at Page (src/app/page.tsx:10:1)',
  ].join('\n')
  assert.equal(topAppFrame(stack), 'src/components/citybeat/CartDrawer.tsx:88')
  assert.equal(topAppFrame(null), '')
  assert.equal(topAppFrame('no frames here'), '')
})

test('a content-hashed bundle filename does not re-fingerprint on every deploy', () => {
  // The same bug, before and after a rebuild that changed the chunk hash.
  const before = 'TypeError: bad\n    at f (static/chunks/page-1a2b3c4d5e.js:1:1)'
  const after = 'TypeError: bad\n    at f (static/chunks/page-9z8y7x6w5v.js:1:1)'
  assert.equal(topAppFrame(before), topAppFrame(after))
})

test('the same bug fingerprints identically across users, releases and ids', () => {
  const one = fingerprintError({
    message: "Cannot read properties of undefined (reading 'total') for order 12345",
    stack: 'at Cart (src/components/Cart.tsx:42:9)',
    route: '/en/ads',
    source: 'client',
  })
  const two = fingerprintError({
    message: "Cannot read properties of undefined (reading 'total') for order 99999",
    stack: 'at Cart (src/components/Cart.tsx:42:9)',
    route: '/es/directory', // different page, same broken component
    source: 'client',
  })
  assert.equal(one, two, 'client errors must group by code location, not by URL')

  // A different code location is a different bug.
  assert.notEqual(
    one,
    fingerprintError({
      message: "Cannot read properties of undefined (reading 'total')",
      stack: 'at Other (src/components/Other.tsx:7:1)',
      route: '/en/ads',
      source: 'client',
    })
  )
  // Server errors DO split by route — the same helper failing in two routes is
  // two different operational problems.
  const s1 = fingerprintError({ message: 'boom', stack: null, route: '/api/a', source: 'server' })
  const s2 = fingerprintError({ message: 'boom', stack: null, route: '/api/b', source: 'server' })
  assert.notEqual(s1, s2)
  // Fingerprints are short, stable, hex.
  assert.match(one, /^[0-9a-f]{16}$/)
})

test('a CLIENT report can never elevate its own severity (public intake)', () => {
  // The intake is public, so `message` is attacker-controlled. Typing "stripe"
  // must not manufacture a critical alert.
  assert.equal(classifySeverity({ message: 'stripe checkout payout refund', route: '/en', source: 'client' }), 'error')
  assert.equal(classifySeverity({ message: 'x', route: '/api/stripe/webhook', source: 'client' }), 'error')
  const forged = normalizeErrorInput({ message: 'stripe payout failed', source: 'client', route: '/api/stripe/webhook' })!
  assert.equal(forged.severity, 'error')
  assert.equal(forged.source, 'client')
})

test('a real production frame (percent-encoded, hashed chunk) groups across deploys', () => {
  // Real Next.js client frames look like this; the filename regex stops at '%',
  // so testing the extracted name (not the raw line) never detected build output.
  const before = [
    'TypeError: x',
    '    at a (https://citybeatmag.co/_next/static/chunks/app/%5Blocale%5D/directory/page-1a2b3c4d5e.js:2:9)',
  ].join('\n')
  const after = [
    'TypeError: x',
    '    at a (https://citybeatmag.co/_next/static/chunks/app/%5Blocale%5D/directory/page-f9e8d7c6b5.js:2:9)',
  ].join('\n')
  assert.equal(topAppFrame(before), topAppFrame(after), 'a rebuild must not create a new issue')
  assert.equal(
    fingerprintError({ message: 'TypeError: x', stack: before, route: '/en', source: 'client' }),
    fingerprintError({ message: 'TypeError: x', stack: after, route: '/en', source: 'client' })
  )
})

test('money paths and unattended automation are critical by definition', () => {
  assert.equal(classifySeverity({ message: 'stripe webhook signature failed', route: null, source: 'server' }), 'critical')
  assert.equal(classifySeverity({ message: 'boom', route: '/api/stripe/checkout', source: 'server' }), 'critical')
  assert.equal(classifySeverity({ message: 'payout transfer failed', route: null, source: 'server' }), 'critical')
  assert.equal(classifySeverity({ message: 'anything', route: null, source: 'cron' }), 'critical')
  assert.equal(classifySeverity({ message: 'anything', route: null, source: 'webhook' }), 'critical')
  // Ordinary UI breakage is an error, not a page-me.
  assert.equal(classifySeverity({ message: 'undefined is not a function', route: '/en', source: 'client' }), 'error')
  // Server-side money paths remain critical.
  assert.equal(classifySeverity({ message: 'checkout exploded', route: '/api/x', source: 'server' }), 'critical')
})

test('normalizeErrorInput validates, caps, and drops noise', () => {
  const ok = normalizeErrorInput({
    message: 'Real bug happened',
    stack: 'at X (src/x.ts:1:1)',
    route: '/en/ads',
    source: 'client',
    release: 'abc1234',
    userAgent: 'Mozilla/5.0',
  })
  assert.ok(ok)
  assert.equal(ok!.severity, 'error')
  assert.match(ok!.fingerprint, /^[0-9a-f]{16}$/)

  // Noise is dropped entirely.
  assert.equal(normalizeErrorInput({ message: 'ResizeObserver loop limit exceeded', source: 'client' }), null)
  assert.equal(normalizeErrorInput({ message: '', source: 'client' }), null)

  // Oversized fields are capped, not rejected (a huge stack is still a real bug).
  const big = normalizeErrorInput({
    message: 'm'.repeat(5000),
    stack: 's'.repeat(50000),
    source: 'server',
    route: 'r'.repeat(5000),
  })!
  assert.ok(big.message.length <= 500)
  assert.ok((big.stack || '').length <= 4000)
  assert.ok((big.route || '').length <= 200)

  // An unknown source falls back to the least-trusted one.
  assert.equal(normalizeErrorInput({ message: 'x', source: 'bogus' as any })!.source, 'client')
})
