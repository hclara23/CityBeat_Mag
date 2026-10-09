import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePrintRecognition, publicPrintRecognition } from './print-recognition'
import { filterEntitledListingUpdate, resolveEntitlements } from './directory-entitlements'
const cover = { id: 'premier-cover', type: 'cover', issue: 'October–November', image_url: '/print/premier-oct-nov.webp' }
test('validates cover evidence without inventing issue year and prioritizes cover', () => {
  const result = publicPrintRecognition([{ id: 'ad', type: 'advertisement', issue: 'Summer' }, cover])
  assert.equal(result[0].type, 'cover')
  assert.equal(result[0].issue, 'October–November')
  assert.equal(result[0].issue_es, result[0].issue)
})
test('print badges reject malformed records, unsafe URLs and duplicate IDs', () => {
  for (const input of [null, {}, [null], [{ ...cover, type: 'award' }], [{ ...cover, issue: '' }], [cover, cover], Array(21).fill(cover)]) {
    assert.throws(() => parsePrintRecognition(input))
  }
  for (const image_url of ['javascript:alert(1)', '//evil.test/a.png', 'http://example.com/image.jpg', 'https://user:pass@example.com/a.png', 'https://example.com/cover.jpg', '/api/private']) {
    assert.throws(() => parsePrintRecognition([{ ...cover, image_url }]))
  }
  assert.deepEqual(publicPrintRecognition([{ ...cover, type: 'fake' }]), [])
})

test('artwork is restricted to renderable storage hosts while issue links accept HTTPS', () => {
  const row = parsePrintRecognition([{ ...cover, image_url: 'https://storage.googleapis.com/bucket/cover.webp', issue_url: 'https://publisher.example/issue' }])[0]
  assert.equal(row.image_url, 'https://storage.googleapis.com/bucket/cover.webp')
  assert.equal(row.issue_url, 'https://publisher.example/issue')
})
test('owner and generic staff PATCH cannot self-award print badges or ownership', () => {
  for (const tier of ['basic', 'premium', 'featured']) for (const isStaff of [false, true]) {
    const { updates } = filterEntitledListingUpdate({ print_recognition: [cover], owner_id: 'attacker', claim_status: 'approved', tier: 'featured', name: 'Allowed' }, { entitlements: resolveEntitlements({ tier }), isStaff })
    assert.deepEqual(updates, { name: 'Allowed' })
  }
})
