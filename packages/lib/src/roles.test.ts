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
  PLATFORM_ROLES,
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

test('editor gets editor + writer, and NOT admin, sales or developer', () => {
  // This test asserted hasAdminAccess(editor) === true and hasSalesAccess ===
  // true, which is the exposure itself written down: the narrowest grant that
  // publishes stories also reached the lead inbox, claim approval, the whole
  // directory and the Sales Desk. Admin still IMPLIES editor, so no existing
  // operator loses anything; editor no longer implies admin.
  const editor = { is_editor: true }
  assert.equal(hasDeveloperAccess(editor), false)
  assert.equal(hasAdminAccess(editor), false)
  assert.equal(hasEditorAccess(editor), true)
  assert.equal(hasWriterAccess(editor), true)
  assert.equal(hasSalesAccess(editor), false)
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
  // Revocation is what this pins. It used 'editor' against hasAdminAccess, which
  // only worked while editor meant admin; both roles are checked now against the
  // predicate each actually grants.
  assert.equal(hasAdminAccess({ profile_roles: [{ role: 'admin', revoked_at: '2026-01-01' }] }), false)
  assert.equal(hasAdminAccess({ profile_roles: [{ role: 'admin', revoked_at: null }] }), true)
  assert.equal(hasEditorAccess({ profile_roles: [{ role: 'editor', revoked_at: '2026-01-01' }] }), false)
  assert.equal(hasEditorAccess({ profile_roles: [{ role: 'editor', revoked_at: null }] }), true)
  // A revoked editor must not retain the newsroom queue via the writer predicate.
  assert.equal(hasWriterAccess({ profile_roles: [{ role: 'editor', revoked_at: '2026-01-01' }] }), false)
})

// ── Primary role resolution ──────────────────────────────────────────────────

test('getPrimaryPlatformRole picks the most privileged role', () => {
  assert.equal(getPrimaryPlatformRole({ is_developer: true, is_editor: true }), 'developer')
  assert.equal(getPrimaryPlatformRole({ is_editor: true }), 'editor')
  assert.equal(getPrimaryPlatformRole({ role: 'admin' }), 'admin')
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

test('developers grant any role; admins cannot grant developer/admin; editors grant nothing', () => {
  const dev = { is_developer: true }
  const admin = { role: 'admin' }
  const editor = { is_editor: true }
  assert.equal(canManageRole(dev, 'developer'), true)
  assert.equal(canManageRole(admin, 'writer'), true)
  assert.equal(canManageRole(admin, 'developer'), false)
  assert.equal(canManageRole(admin, 'admin'), false)
  // An editor could previously grant 'editor' to another account — the
  // self-propagating half of the exposure. canManageRole requires admin.
  assert.equal(canManageRole(editor, 'writer'), false)
  assert.equal(canManageRole(editor, 'editor'), false)
  assert.equal(canManageRole({}, 'writer'), false)
})

test('normalizeRequestedRoles keeps only known roles, deduped', () => {
  assert.deepEqual(normalizeRequestedRoles(['writer', 'writer', 'bogus', 'sales']).sort(), ['sales', 'writer'])
  assert.deepEqual(normalizeRequestedRoles('not-an-array' as any), [])
  assert.deepEqual(normalizeRequestedRoles([1, 2, null] as any), [])
})

// ---------------------------------------------------------------------------
// Editor is a real role, not an alias for admin.
//
// hasEditorAccess used to BE hasAdminAccess — literally `return
// hasAdminAccess(profile)` — and hasAdminAccess itself honoured is_editor. So
// the narrowest grant that lets somebody publish the newsroom queue also read
// every contact and quote request the public has submitted, approved paid
// claims, let them edit any of 12,000 listings including paying ones, and let
// them grant editor to another account.
// ---------------------------------------------------------------------------

const editorOnly = { id: 'e1', role: 'editor' }
const isEditorFlag = { id: 'e2', is_editor: true }

test('a bare editor can publish stories and nothing else operator-level', () => {
  for (const profile of [editorOnly, isEditorFlag]) {
    assert.equal(hasEditorAccess(profile), true, 'must reach the newsroom queue')
    assert.equal(hasWriterAccess(profile), true, 'must reach the creator tools that feed it')
    assert.equal(hasAdminAccess(profile), false, 'must NOT reach leads, claims or the directory')
    assert.equal(hasDeveloperAccess(profile), false)
    assert.equal(hasSalesAccess(profile), false)
  }
})

test('an editor cannot grant roles, including their own', () => {
  // canManageRole requires admin, so an editor can no longer promote a second
  // account to editor — which was the self-propagating half of the exposure.
  for (const role of PLATFORM_ROLES) {
    assert.equal(canManageRole(editorOnly, role), false, `editor must not grant ${role}`)
  }
})

test('every existing operator keeps everything they had', () => {
  // The live profiles: one developer with every role granted, and one carrying
  // role 'admin' together with is_editor. Neither may lose access.
  const developer = { id: 'd', role: 'developer', is_developer: true, can_manage_platform: true, is_editor: true }
  const adminWithEditorFlag = { id: 'a', role: 'admin', is_editor: true }
  for (const profile of [developer, adminWithEditorFlag]) {
    assert.equal(hasAdminAccess(profile), true)
    assert.equal(hasEditorAccess(profile), true)
    assert.equal(hasWriterAccess(profile), true)
    assert.equal(hasSalesAccess(profile), true)
  }
})

test('an editor is labelled an editor', () => {
  assert.equal(getPrimaryPlatformRole(editorOnly), 'editor')
  // and still lands on the admin shell, where the review queue lives
  assert.equal(dashboardPathFor(editorOnly), '/admin')
})
