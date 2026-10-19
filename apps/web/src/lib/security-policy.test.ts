import test from 'node:test'
import assert from 'node:assert/strict'
import { contentSecurityPolicy } from './security-policy'

test('production scripts require a nonce and forbid inline handlers and eval', () => {
  const policy = contentSecurityPolicy('test-nonce')
  const scripts = policy.split('; ').find(x => x.startsWith('script-src '))!
  assert.ok(scripts.includes("'nonce-test-nonce'"))
  assert.ok(scripts.includes("'strict-dynamic'"))
  assert.ok(!scripts.includes('unsafe-inline'))
  assert.ok(!scripts.includes('unsafe-eval'))
  assert.ok(policy.includes("script-src-attr 'none'"))
  assert.ok(policy.includes("object-src 'none'"))
})

test('eval is enabled only for the development runtime', () => {
  assert.ok(contentSecurityPolicy('test', true).includes("'unsafe-eval'"))
  assert.ok(!contentSecurityPolicy('test').includes("'unsafe-eval'"))
})
