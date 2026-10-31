import assert from 'node:assert/strict'
import test from 'node:test'
import { decryptGbpToken, encryptGbpToken, gbpImportPatch, mapGoogleLocation, signGbpState, verifyGbpState } from './google-business'

process.env.GBP_OAUTH_STATE_SECRET = 'state-secret-at-least-thirty-two-characters'
process.env.GBP_TOKEN_ENCRYPTION_KEY = 'token-secret-at-least-thirty-two-characters'

test('GBP OAuth state is signed, scoped, and expires', () => {
  const state = signGbpState({ listingId: 'listing-1', userId: 'user-1', locale: 'en' }, 1_000)
  assert.equal(verifyGbpState(state, 2_000).listingId, 'listing-1')
  assert.throws(() => verifyGbpState(`${state}x`, 2_000), /Invalid OAuth state/)
  assert.throws(() => verifyGbpState(state, 1_000 + 10 * 60_000 + 1), /Expired OAuth state/)
})

test('platform reporting OAuth purpose cannot be changed to an advertiser connection', () => {
  const signed = signGbpState({ listingId: 'citybeat', userId: 'admin-1', locale: 'en', purpose: 'platform_analytics' }, 1000)
  assert.equal(verifyGbpState(signed, 2000).purpose, 'platform_analytics')
  const [payload, signature] = signed.split('.')
  const state = JSON.parse(Buffer.from(payload, 'base64url').toString())
  delete state.purpose
  assert.throws(() => verifyGbpState(`${Buffer.from(JSON.stringify(state)).toString('base64url')}.${signature}`, 2000))
})

test('GBP refresh tokens encrypt with authenticated encryption', () => {
  const encrypted = encryptGbpToken('refresh-token-value')
  assert.notEqual(encrypted, 'refresh-token-value')
  assert.equal(decryptGbpToken(encrypted), 'refresh-token-value')
  const parts = encrypted.split('.')
  // Flip a significant base64url character. Changing the final character can
  // alter only unused padding bits, which decodes to identical bytes on Linux.
  parts[2] = `${parts[2].startsWith('A') ? 'B' : 'A'}${parts[2].slice(1)}`
  assert.throws(() => decryptGbpToken(parts.join('.')))
})

test('GBP locations map to a reviewable CityBeat patch', () => {
  const location = mapGoogleLocation({ name: 'locations/123', title: 'CityBeat Magazine', websiteUri: 'https://citybeatmag.co', phoneNumbers: { primaryPhone: '(915) 500-9640' }, storefrontAddress: { addressLines: ['100 Main St'], locality: 'El Paso', administrativeArea: 'TX', postalCode: '79901' }, profile: { description: 'Local news.' }, regularHours: { periods: [{ openDay: 'MONDAY', closeDay: 'MONDAY', openTime: { hours: 8 }, closeTime: { hours: 17 } }] } })
  assert.equal(location.address, '100 Main St, El Paso TX 79901')
  assert.equal(location.hours?.Monday, '08:00–17:00')
  assert.deepEqual(gbpImportPatch(location), { name: 'CityBeat Magazine', address: '100 Main St, El Paso TX 79901', phone: '(915) 500-9640', website: 'https://citybeatmag.co', description: 'Local news.', hours: { Monday: '08:00–17:00' } })
})
