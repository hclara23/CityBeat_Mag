import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveEntitlements } from './directory-entitlements'
import { ownerListingProgress } from './owner-listing-progress'

test('Basic owners are not directed to fields locked in the owner editor', () => {
  const summary = ownerListingProgress({ name: 'Example' }, resolveEntitlements({ tier: 'basic' }))
  assert.equal(summary.completed, 1)
  assert.equal(summary.total, 6)
  assert.ok(!summary.items.some(item => ['description', 'description_es', 'image', 'social'].includes(item.key)))
})
test('paid owners receive actionable missing fields with bilingual labels', () => {
  const summary = ownerListingProgress({ name: 'Example', description: 'short' }, resolveEntitlements({ tier: 'premium' }))
  assert.equal(summary.total, 10)
  assert.equal(summary.items.find(item => item.key === 'description')?.done, false)
  assert.equal(summary.items.find(item => item.key === 'image')?.section, 'media')
  assert.equal(summary.items.find(item => item.key === 'hours')?.section, 'hours')
  assert.ok(summary.items.every(item => item.label && item.label_es))
})
