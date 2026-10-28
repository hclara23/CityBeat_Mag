import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptsClaimSmsConsent, CLAIM_SMS_CONSENT_VERSION } from './claim-sms-consent'

test('SMS requests require an affirmative boolean, not a truthy API value', () => {
  for (const value of [undefined, null, false, 'true', 'false', 1, {}, []]) {
    assert.equal(acceptsClaimSmsConsent(value, CLAIM_SMS_CONSENT_VERSION), false)
  }
  assert.equal(acceptsClaimSmsConsent(true, CLAIM_SMS_CONSENT_VERSION), true)
})

test('stale clients must redisplay the current disclosure before sending', () => {
  for (const version of [undefined, null, '', '2026-10-27', true]) {
    assert.equal(acceptsClaimSmsConsent(true, version), false)
  }
})
