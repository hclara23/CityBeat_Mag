import { test } from 'node:test'
import assert from 'node:assert/strict'
import { permittedSource, sportsUpdate, type SportsSource } from './sports-policy'

const now = Date.parse('2026-10-08T12:00:00Z')
const source: SportsSource = { name: 'Owned', enabled: true, permission_basis: 'owned', permission_evidence: 'CityBeat original reporting', permission_expires: '2027-01-01' }
test('sports permissions require evidence, active status, and future expiry', () => {
  assert.equal(permittedSource(source, now), true)
  assert.equal(permittedSource(undefined, now), false)
  for (const changes of [{ enabled: false }, { permission_basis: 'public_rss' }, { permission_evidence: '' }, { permission_expires: '2020-01-01' }, { permission_expires: 'invalid' }]) {
    assert.equal(permittedSource({ ...source, ...changes }, now), false)
  }
})
test('sports updates reject unsafe URLs and stale/future dates', () => {
  const value = { title: 'Community sports update', body: 'An original update from our authorized contributor.', author: 'CityBeat', external_id: 'game-1', published_at: '2026-10-08T11:00:00Z' }
  assert.equal(sportsUpdate(value, now).source_url, null)
  for (const changes of [{ source_url: 'javascript:alert(1)' }, { source_url: 'https://user:secret@example.com' }, { published_at: '2020-01-01' }, { published_at: '2027-01-01' }, { body: '' }]) {
    assert.throws(() => sportsUpdate({ ...value, ...changes }, now))
  }
})
