import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getClientIp } from './auth-security'

// getClientIp gates ~25 rate limiters, including /api/chat which spends real
// money per request. These tests pin the trust model: entries a CALLER can put
// in X-Forwarded-For must never be treated as the client identity.

const req = (headers: Record<string, string>) => new Request('https://citybeatmag.co/', { headers })

test('the caller-supplied left side of X-Forwarded-For is never trusted', () => {
  // The attack: prepend a fake IP and rotate it to mint unlimited buckets.
  // Infrastructure APPENDS, so the real client is on the right.
  const spoofed = getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9, 130.211.0.1' }))
  assert.notEqual(spoofed, '1.2.3.4', 'must not return the spoofable leftmost entry')

  // Rotating the spoofed prefix must NOT change the bucket — that is the whole
  // point; otherwise the limiter is free to bypass.
  const a = getClientIp(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.9, 130.211.0.1' }))
  const b = getClientIp(req({ 'x-forwarded-for': '8.8.8.8, 203.0.113.9, 130.211.0.1' }))
  assert.equal(a, b, 'a rotating spoofed prefix must map to one bucket')
})

test('distinct real clients still get distinct buckets', () => {
  // Legitimate traffic must not collapse into a single shared bucket, which
  // would rate-limit real users against each other.
  const one = getClientIp(req({ 'x-forwarded-for': '203.0.113.9, 130.211.0.1' }))
  const two = getClientIp(req({ 'x-forwarded-for': '198.51.100.7, 130.211.0.1' }))
  assert.notEqual(one, two)
  assert.equal(one, '203.0.113.9')
})

test('short and malformed headers degrade to a usable value, never to a shared bucket', () => {
  // A single entry (direct hit / fewer hops than expected) is still that caller.
  assert.equal(getClientIp(req({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9')
  // Whitespace and empty segments are tolerated.
  assert.equal(getClientIp(req({ 'x-forwarded-for': '  203.0.113.9 ,  130.211.0.1  ' })), '203.0.113.9')
  assert.equal(getClientIp(req({ 'x-forwarded-for': ',,' })), 'unknown')
  // Falls back to x-real-ip, then to a constant only when there is nothing.
  assert.equal(getClientIp(req({ 'x-real-ip': '203.0.113.5' })), '203.0.113.5')
  assert.equal(getClientIp(req({})), 'unknown')
})
