import assert from 'node:assert/strict'
import test from 'node:test'
import { DIRECTORY_SITEMAP_PAGE_SIZE, directorySitemapPageCount } from './directory-sitemap'

test('directory sitemap stays within the search-engine URL ceiling', () => {
  assert.equal(DIRECTORY_SITEMAP_PAGE_SIZE, 45_000)
  assert.ok(DIRECTORY_SITEMAP_PAGE_SIZE < 50_000)
  assert.equal(directorySitemapPageCount(0), 1)
  assert.equal(directorySitemapPageCount(45_000), 1)
  assert.equal(directorySitemapPageCount(45_001), 2)
  assert.equal(directorySitemapPageCount(100_000), 3)
  assert.equal(directorySitemapPageCount(Number.NaN), 1)
})
