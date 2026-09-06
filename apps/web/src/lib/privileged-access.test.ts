import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TWO_FACTOR_REQUIRED, privilegedDenial } from './privileged-access'

test('a role-holder who never enrolled in 2FA is refused', () => {
  // The regression this pins: fourteen privileged routes checked the role only,
  // so a phished staff password could still call the customer-PII export and the
  // role-granting endpoint even though every page behind them redirected.
  const denial = privilegedDenial({ is_developer: true, mfa_enabled: false }, true)
  assert.deepEqual(denial, { error: TWO_FACTOR_REQUIRED, status: 403 })
})

test('a profile predating the 2FA field is treated as not enrolled', () => {
  assert.deepEqual(privilegedDenial({ is_developer: true }, true), {
    error: TWO_FACTOR_REQUIRED,
    status: 403,
  })
  assert.deepEqual(privilegedDenial(null, true), { error: TWO_FACTOR_REQUIRED, status: 403 })
})

test('turning 2FA off closes the APIs, not just the pages', () => {
  // /api/auth/2fa/disable writes mfa_enabled:false. Before this gate the UI
  // locked that operator out while every API kept answering them.
  assert.equal(privilegedDenial({ can_manage_platform: true, mfa_enabled: true }, true), null)
  assert.deepEqual(privilegedDenial({ can_manage_platform: true, mfa_enabled: false }, true), {
    error: TWO_FACTOR_REQUIRED,
    status: 403,
  })
})

test('the role check runs first, so the error never advertises the 2FA gate', () => {
  // A caller without the role must not learn that a second factor is the only
  // thing left between them and the endpoint.
  assert.deepEqual(privilegedDenial({ mfa_enabled: true }, false), {
    error: 'Forbidden',
    status: 403,
  })
  assert.deepEqual(privilegedDenial({ mfa_enabled: false }, false), {
    error: 'Forbidden',
    status: 403,
  })
})

test('an enrolled role-holder is allowed through', () => {
  assert.equal(privilegedDenial({ is_editor: true, mfa_enabled: true }, true), null)
})
