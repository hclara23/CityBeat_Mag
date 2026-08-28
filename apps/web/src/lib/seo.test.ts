import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localeAlternates, breadcrumbJsonLd, normLocale } from './seo'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

test('normLocale collapses anything non-es to en', () => {
  assert.equal(normLocale('es'), 'es')
  assert.equal(normLocale('en'), 'en')
  assert.equal(normLocale('fr'), 'en')
  assert.equal(normLocale(undefined), 'en')
})

test('localeAlternates: self-canonical + en/es/x-default, x-default = en', () => {
  const a = localeAlternates('es', '/directory')
  assert.equal(a.canonical, `${BASE}/es/directory`)
  assert.equal(a.languages.en, `${BASE}/en/directory`)
  assert.equal(a.languages.es, `${BASE}/es/directory`)
  assert.equal(a.languages['x-default'], `${BASE}/en/directory`)
})

test('localeAlternates: root path has no trailing segment', () => {
  const a = localeAlternates('en', '/')
  assert.equal(a.canonical, `${BASE}/en`)
  assert.equal(a.languages.es, `${BASE}/es`)
})

test('localeAlternates: strips a query string and duplicate slashes (consolidates filters)', () => {
  // Callers pass a clean path, but guard against accidental leading/trailing slashes.
  const a = localeAlternates('en', 'stories/')
  assert.equal(a.canonical, `${BASE}/en/stories`)
})

test('breadcrumbJsonLd: positions are 1-based and the leaf has no item URL', () => {
  const b: any = breadcrumbJsonLd('en', [
    { name: 'Home', path: '/' },
    { name: 'Directory', path: '/directory' },
    { name: 'Joe Coffee' },
  ])
  assert.equal(b['@type'], 'BreadcrumbList')
  assert.equal(b.itemListElement.length, 3)
  assert.equal(b.itemListElement[0].position, 1)
  assert.equal(b.itemListElement[1].item, `${BASE}/en/directory`)
  // Current page (leaf) carries a name but no item URL.
  assert.equal(b.itemListElement[2].item, undefined)
  assert.equal(b.itemListElement[2].name, 'Joe Coffee')
})
