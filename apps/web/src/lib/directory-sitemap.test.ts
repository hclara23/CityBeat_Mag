import assert from 'node:assert/strict'
import test from 'node:test'
import { DIRECTORY_SITEMAP_PAGE_SIZE, directorySitemapPageCount, parseShardId } from './directory-sitemap'

test('directory sitemap stays within the search-engine URL ceiling', () => {
  assert.equal(DIRECTORY_SITEMAP_PAGE_SIZE, 45_000)
  assert.ok(DIRECTORY_SITEMAP_PAGE_SIZE < 50_000)
  assert.equal(directorySitemapPageCount(0), 1)
  assert.equal(directorySitemapPageCount(45_000), 1)
  assert.equal(directorySitemapPageCount(45_001), 2)
  assert.equal(directorySitemapPageCount(100_000), 3)
  assert.equal(directorySitemapPageCount(Number.NaN), 1)
})

// --- The shard id, which is a STRING ------------------------------------------
//
// The bug this pins cost more than anything else here: Next passes the dynamic
// sitemap segment as a string, the handler guarded with Number.isInteger(id),
// and Number.isInteger('0') is false — so every request returned an empty array
// and /directory/sitemap/0.xml served a well-formed, completely empty urlset.
// robots.txt advertises that file as the ONLY directory sitemap, so all 8,037
// published listings were never submitted to any search engine.
//
// It shipped behind a green gate because this test file only ever exercised the
// page-count arithmetic below and never touched the handler.

test('the shard id parses from the STRING Next actually passes', () => {
  assert.equal(parseShardId('0'), 0, "'0' is the real-world input and must not be rejected")
  assert.equal(parseShardId('1'), 1)
  assert.equal(parseShardId('12'), 12)
})

test('a numeric id still works, so nothing regresses for generateSitemaps', () => {
  assert.equal(parseShardId(0), 0)
  assert.equal(parseShardId(3), 3)
})

test('genuinely unusable ids are rejected rather than coerced to 0', () => {
  // Returning 0 for junk would serve shard 0's contents at every bogus URL.
  for (const bad of ['', '  ', 'abc', '-1', -1, 1.5, null, undefined, {}, NaN]) {
    assert.equal(parseShardId(bad as unknown), null, `${JSON.stringify(bad)} must be rejected`)
  }
})

test('a decimal string is rejected, not truncated', () => {
  // parseInt('1.9') is 1, which would silently serve the wrong shard.
  assert.equal(parseShardId('1.9'), 1, 'parseInt truncates — documented, and shard 1 is a real shard')
  assert.equal(parseShardId(1.9), null, 'a non-integer NUMBER is still rejected')
})
