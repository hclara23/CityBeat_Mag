import test from 'node:test'
import assert from 'node:assert/strict'
import { serializeSitemap } from './sitemap-xml'

test('sitemap escapes URLs and language attributes and preserves real dates', () => {
  const xml = serializeSitemap([{ url: 'https://example.com/?a=1&b=2', lastModified: new Date('2026-10-19T00:00:00Z'), alternates: { languages: { es: 'https://example.com/es?a=1&b=2' } } }])
  assert.ok(xml.includes('?a=1&amp;b=2'))
  assert.ok(xml.includes('<lastmod>2026-10-19T00:00:00.000Z</lastmod>'))
  assert.ok(xml.includes('hreflang="es"'))
})

test('sitemap deduplicates URLs and never invents modification dates', () => {
  const xml = serializeSitemap([{ url: 'https://example.com/' }, { url: 'https://example.com/' }])
  assert.equal(xml.match(/<url>/g)?.length, 1)
  assert.ok(!xml.includes('lastmod'))
})
