import test from 'node:test'
import assert from 'node:assert/strict'
import { googleProfileForSignIn, googleSessionOutcome, validGoogleIdentity, trustedSignInOrigin, newGoogleProfile } from './google-signin-policy'

test('Google session exchange requires recent verified Google authentication', () => {
  const token = { firebase: { sign_in_provider: 'google.com' }, email_verified: true, auth_time: 1000 }
  assert.equal(validGoogleIdentity(token, 1100), true)
  for (const invalid of [{ ...token, auth_time: 1 }, { ...token, auth_time: 1200 },
    { ...token, email_verified: false }, { ...token, firebase: { sign_in_provider: 'password' } }, {}]) {
    assert.equal(validGoogleIdentity(invalid, 1100), false)
  }
})
test('session exchange rejects missing and lookalike origins', () => {
  for (const origin of [null, 'null', 'https://evil.test', 'https://citybeatmag.co.evil.test']) {
    assert.equal(trustedSignInOrigin(origin, 'https://citybeatmag.co'), false)
  }
  assert.equal(trustedSignInOrigin('https://citybeatmag.co', 'https://citybeatmag.co'), true)
})
test('new Google users receive no listing or staff privileges', () => {
  const profile = newGoogleProfile('uid', 'owner@example.com', 'Owner', 'es')
  assert.equal(profile.role, 'reader')
  assert.equal(profile.is_editor, false)
  assert.equal(profile.is_developer, false)
  assert.equal(profile.is_advertiser, false)
  assert.equal(profile.locale, 'es')
  assert.equal('owner_id' in profile, false)
})

test('existing Google account profile preserves roles, MFA and notification preferences', () => {
  const existing = { role: 'editor', mfa_enabled: true, notify_prefs: { activity_email: false } }
  assert.equal(googleProfileForSignIn(existing, newGoogleProfile('uid', 'a@example.com', '', 'en')), existing)
})
test('Google MFA challenge never issues a session cookie', async () => {
  let cookies = 0
  const result = await googleSessionOutcome({ mfa_enabled: true }, {
    createMfaChallenge: async () => 'challenge', createCookie: async () => { cookies++; return 'cookie' },
  })
  assert.deepEqual(result, { kind: 'mfa', token: 'challenge' })
  assert.equal(cookies, 0)
})
test('Google session without MFA creates only a cookie', async () => {
  const result = await googleSessionOutcome({ mfa_enabled: false }, {
    createMfaChallenge: async () => { throw new Error('Unexpected MFA') }, createCookie: async () => 'cookie',
  })
  assert.deepEqual(result, { kind: 'session', cookie: 'cookie' })
})
