import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasDeveloperAccess,
  hasAdminAccess,
  hasEditorAccess,
  hasWriterAccess,
  hasSalesAccess,
  getPrimaryPlatformRole,
  canManageRole,
  normalizeRequestedRoles,
} from './roles'

// ── Access gates ─────────────────────────────────────────────────────────────

test('developer flag grants developer + all lower access', () => {
  const dev = { is_developer: true }
  assert.equal(hasDeveloperAccess(dev), true)
  assert.equal(hasAdminAccess(dev), true)
  assert.equal(hasSalesAccess(dev), true)
  assert.equal(hasWriterAccess(dev), true)
})

test('editor gets admin/editor/writer/sales but NOT developer', () => {
  const editor = { is_editor: true }
  assert.equal(hasDeveloperAccess(editor), false)
  assert.equal(hasAdminAccess(editor), true)
  assert.equal(hasEditorAccess(editor), true)
  assert.equal(hasWriterAccess(editor), true)
  assert.equal(hasSalesAccess(editor), true)
})

test('sales flag grants sales only, not admin', () => {
  const sales = { is_sales: true }
  assert.equal(hasSalesAccess(sales), true)
  assert.equal(hasAdminAccess(sales), false)
  assert.equal(hasDeveloperAccess(sales), false)
})

test('sales_dashboard_enabled grants sales access', () => {
  assert.equal(hasSalesAccess({ sales_dashboard_enabled: true }), true)
})

test('null / empty / plain reader profile has no elevated access', () => {
  for (const p of [null, undefined, {}, { is_advertiser: true }]) {
    assert.equal(hasDeveloperAccess(p as any), false)
    assert.equal(hasAdminAccess(p as any), false)
    assert.equal(hasSalesAccess(p as any), false)
  }
})

test('revoked profile_roles do not grant access', () => {
  const revoked = { profile_roles: [{ role: 'editor', revoked_at: '2026-01-01' }] }
  assert.equal(hasAdminAccess(revoked), false)
  const active = { profile_roles: [{ role: 'editor', revoked_at: null }] }
  assert.equal(hasAdminAccess(active), true)
})

// ── Primary role resolution ──────────────────────────────────────────────────

test('getPrimaryPlatformRole picks the most privileged role', () => {
  assert.equal(getPrimaryPlatformRole({ is_developer: true, is_editor: true }), 'developer')
  assert.equal(getPrimaryPlatformRole({ is_editor: true }), 'admin')
  assert.equal(getPrimaryPlatformRole({ is_sales: true }), 'sales')
  assert.equal(getPrimaryPlatformRole({ is_writer: true }), 'writer')
  assert.equal(getPrimaryPlatformRole({ is_advertiser: true }), 'advertiser')
  assert.equal(getPrimaryPlatformRole({}), 'visitor')
  assert.equal(getPrimaryPlatformRole(null), 'visitor')
})

// ── Role management authority ────────────────────────────────────────────────

test('developers can grant any role; editors cannot grant developer/admin', () => {
  const dev = { is_developer: true }
  const editor = { is_editor: true }
  assert.equal(canManageRole(dev, 'developer'), true)
  assert.equal(canManageRole(editor, 'writer'), true)
  assert.equal(canManageRole(editor, 'developer'), false)
  assert.equal(canManageRole(editor, 'admin'), false)
  assert.equal(canManageRole({}, 'writer'), false)
})

test('normalizeRequestedRoles keeps only known roles, deduped', () => {
  assert.deepEqual(normalizeRequestedRoles(['writer', 'writer', 'bogus', 'sales']).sort(), ['sales', 'writer'])
  assert.deepEqual(normalizeRequestedRoles('not-an-array' as any), [])
  assert.deepEqual(normalizeRequestedRoles([1, 2, null] as any), [])
})
