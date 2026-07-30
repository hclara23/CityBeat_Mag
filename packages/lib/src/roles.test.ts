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
  resolvePlatformCapabilities,
  dashboardPathFor,
} from './roles'

// ── Access gates ─────────────────────────────────────────────────────────────

test('developer flag grants developer + all lower access', () => {
  const dev = { is_developer: true }
  assert.equal(hasDeveloperAccess(dev), true)
  assert.equal(hasAdminAccess(dev), true)
  assert.equal(hasSalesAccess(dev), true)
  assert.equal(hasWriterAccess(dev), true)
})

test('developer resolves to every cumulative platform capability', () => {
  assert.deepEqual(resolvePlatformCapabilities({ is_developer: true }), {
    primary_role: 'developer',
    is_developer: true,
    can_manage_platform: true,
    is_editor: true,
    is_writer: true,
    is_sales: true,
    sales_dashboard_enabled: true,
    is_advertiser: true,
  })
})

test('developer role sources and granted_roles receive the same godmode access', () => {
  for (const profile of [
    { role: 'developer' },
    { can_manage_platform: true },
    { granted_roles: ['developer'] },
    { profile_roles: [{ role: 'developer', revoked_at: null }] },
  ]) {
    assert.equal(resolvePlatformCapabilities(profile).is_developer, true)
    assert.equal(resolvePlatformCapabilities(profile).is_advertiser, true)
    assert.equal(dashboardPathFor(profile), '/developer')
  }
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

test('dashboardPathFor always routes by the highest effective role', () => {
  assert.equal(dashboardPathFor({ is_developer: true, is_editor: true }), '/developer')
  assert.equal(dashboardPathFor({ is_editor: true, is_sales: true }), '/admin')
  assert.equal(dashboardPathFor({ is_sales: true, is_writer: true }), '/admin/sales/me')
  assert.equal(dashboardPathFor({ is_writer: true, is_advertiser: true }), '/creator')
  assert.equal(dashboardPathFor({ is_advertiser: true }), '/dashboard')
  assert.equal(dashboardPathFor({}), '/account')
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
