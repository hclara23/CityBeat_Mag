import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSessionRevoked, revokeAllPatch, revokeUserPatch } from './revocation'

// This is the only thing standing between "we revoked that admin" and a session
// cookie that keeps working for another five days, so the edges matter more than
// the happy path.

const AT = (iso: string) => Math.floor(Date.parse(iso) / 1000)

test('a session signed in before its revocation is dead; one after is fine', () => {
  const record = { users: { rep1: '2026-09-05T12:00:00Z' } }

  assert.equal(isSessionRevoked({ uid: 'rep1', auth_time: AT('2026-09-05T11:59:59Z') }, record), true)
  assert.equal(isSessionRevoked({ uid: 'rep1', auth_time: AT('2026-09-05T12:00:01Z') }, record), false)
  // Somebody else's revocation must not touch this user.
  assert.equal(isSessionRevoked({ uid: 'rep2', auth_time: AT('2026-09-05T11:59:59Z') }, record), false)
})

test('a global revocation ends every session, whoever they are', () => {
  const record = { all: '2026-09-05T12:00:00Z' }
  assert.equal(isSessionRevoked({ uid: 'anyone', auth_time: AT('2026-09-05T11:00:00Z') }, record), true)
  assert.equal(isSessionRevoked({ uid: 'anyone', auth_time: AT('2026-09-05T13:00:00Z') }, record), false)
  // No uid at all still gets caught by a global revocation.
  assert.equal(isSessionRevoked({ auth_time: AT('2026-09-05T11:00:00Z') }, record), true)
})

test('the later of the two cutoffs wins, in both directions', () => {
  const userLater = { all: '2026-09-01T00:00:00Z', users: { rep1: '2026-09-05T12:00:00Z' } }
  assert.equal(isSessionRevoked({ uid: 'rep1', auth_time: AT('2026-09-03T00:00:00Z') }, userLater), true)

  const globalLater = { all: '2026-09-05T12:00:00Z', users: { rep1: '2026-09-01T00:00:00Z' } }
  assert.equal(isSessionRevoked({ uid: 'rep1', auth_time: AT('2026-09-03T00:00:00Z') }, globalLater), true)
})

test('auth_time wins over iat, so refreshing a cookie cannot outrun a revocation', () => {
  // The cookie was reissued after the revocation, but the person authenticated
  // before it. Trusting `iat` here would hand a revoked session a way back in.
  const record = { users: { rep1: '2026-09-05T12:00:00Z' } }
  const claims = {
    uid: 'rep1',
    auth_time: AT('2026-09-05T10:00:00Z'),
    iat: AT('2026-09-05T13:00:00Z'),
  }
  assert.equal(isSessionRevoked(claims, record), true)
})

test('iat is used only when auth_time is missing', () => {
  const record = { users: { rep1: '2026-09-05T12:00:00Z' } }
  assert.equal(isSessionRevoked({ uid: 'rep1', iat: AT('2026-09-05T11:00:00Z') }, record), true)
  assert.equal(isSessionRevoked({ uid: 'rep1', iat: AT('2026-09-05T13:00:00Z') }, record), false)
})

test('a missing or malformed revocation record fails OPEN', () => {
  // A corrupt document must never log out the entire user base.
  const claims = { uid: 'rep1', auth_time: AT('2026-09-05T11:00:00Z') }
  assert.equal(isSessionRevoked(claims, null), false)
  assert.equal(isSessionRevoked(claims, undefined), false)
  assert.equal(isSessionRevoked(claims, {}), false)
  assert.equal(isSessionRevoked(claims, { users: {} }), false)
  assert.equal(isSessionRevoked(claims, { all: 'not a date' }), false)
  assert.equal(isSessionRevoked(claims, { users: { rep1: 'not a date' } }), false)
  assert.equal(isSessionRevoked(claims, { users: { rep1: null } }), false)
})

test('a session we cannot date fails CLOSED against a real revocation', () => {
  // The other direction: if there IS a revocation and the cookie carries no
  // usable timestamp, it does not get the benefit of the doubt.
  const record = { users: { rep1: '2026-09-05T12:00:00Z' } }
  assert.equal(isSessionRevoked({ uid: 'rep1' }, record), true)
  assert.equal(isSessionRevoked({ uid: 'rep1', auth_time: 'yesterday' }, record), true)
  assert.equal(isSessionRevoked({ uid: 'rep1', auth_time: null }, record), true)
  // …but with nothing revoked for them, an undated session is still let through.
  assert.equal(isSessionRevoked({ uid: 'rep1' }, { users: { other: '2026-09-05T12:00:00Z' } }), false)
})

test('the patches are merge-safe and carry the moment of revocation', () => {
  const now = new Date('2026-09-05T12:00:00Z')
  assert.deepEqual(revokeUserPatch('rep1', now), { users: { rep1: '2026-09-05T12:00:00.000Z' } })
  assert.deepEqual(revokeAllPatch(now), { all: '2026-09-05T12:00:00.000Z' })
  // Revoking one person must not carry an `all` key that would sign out everyone.
  assert.equal('all' in revokeUserPatch('rep1', now), false)
})
