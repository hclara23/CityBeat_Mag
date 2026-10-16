import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generatePixelKey,
  hashPixelKey,
  isAllowedPixelOrigin,
  isPixelEvent,
  normalizePixelDomains,
  pixelKeyMatches,
  pixelStatField,
} from './conversion-pixel'

test('normalizes and limits pixel domains', () => {
  assert.deepEqual(normalizePixelDomains(['https://www.Example.com/path', 'example.com', 'shop.example.com']), ['example.com', 'shop.example.com'])
  assert.deepEqual(normalizePixelDomains(['bad host', 'localhost']), ['localhost'])
})

test('allows a configured domain and its subdomains only', () => {
  assert.equal(isAllowedPixelOrigin('https://example.com/page', ['example.com']), true)
  assert.equal(isAllowedPixelOrigin('https://shop.example.com', ['example.com']), true)
  assert.equal(isAllowedPixelOrigin('https://example.com.evil.test', ['example.com']), false)
  assert.equal(isAllowedPixelOrigin(null, ['example.com']), false)
})

test('keys are random, hashed, and compared safely', () => {
  const key = generatePixelKey()
  assert.ok(key.length >= 32)
  assert.equal(pixelKeyMatches(key, hashPixelKey(key)), true)
  assert.equal(pixelKeyMatches(`${key}x`, hashPixelKey(key)), false)
})

test('accepts only supported aggregate events', () => {
  assert.equal(isPixelEvent('purchase'), true)
  assert.equal(isPixelEvent('email'), false)
  assert.equal(pixelStatField('page_view'), 'external_site_view')
  assert.equal(pixelStatField('lead'), 'external_conversion')
})
