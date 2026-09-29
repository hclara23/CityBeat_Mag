import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestEmail, isOwnInbox } from './enrich-contacts'

// Real September 2026 cases: the address on file belonged to someone else.
test("another company's address on a business's site is rejected", () => {
  assert.equal(isOwnInbox('clients@townsquareinteractive.com', 'therockhouseeptx.com'), false) // web agency
  assert.equal(isOwnInbox('b.barrow@rmelp.org', 'hallelujahbbq.org'), false) // a charity
  assert.equal(isOwnInbox('jsalgado@eptxsalgado.com', 'theedgeoftexas.com'), false)
})

test("the business's own domain, any subdomain of it, and personal mailboxes pass", () => {
  assert.equal(isOwnInbox('hector@takotakotacos.com', 'www.takotakotacos.com'), true)
  assert.equal(isOwnInbox('events@mail.oaknantler.com', 'oaknantler.com'), true)
  assert.equal(isOwnInbox('barrioeatsanddrinks@gmail.com', 'barrioeatseptx.com'), true)
  assert.equal(isOwnInbox('owner@shop.example.co.uk', 'www.example.co.uk'), true)
})

test('no known site host keeps the old behaviour', () => {
  assert.equal(isOwnInbox('clients@townsquareinteractive.com', undefined), true)
})

test('the agency credit never wins over a real inbox, and alone yields nothing', () => {
  const host = 'therockhouseeptx.com'
  assert.equal(bestEmail(['clients@townsquareinteractive.com', 'rockhousebar@gmail.com'], host), 'rockhousebar@gmail.com')
  assert.equal(bestEmail(['clients@townsquareinteractive.com'], host), null)
})

test('an own-domain address beats a personal one', () => {
  assert.equal(bestEmail(['owner@gmail.com', 'info@takotakotacos.com'], 'takotakotacos.com'), 'info@takotakotacos.com')
})
