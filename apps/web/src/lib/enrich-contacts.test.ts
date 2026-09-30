import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestEmail, isChainLocatorUrl, isOwnInbox } from './enrich-contacts'

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

test('the same business on a variant domain is still its own inbox', () => {
  assert.equal(isOwnInbox('stephenortiz@desertoakbbq.com', 'www.desertoakbarbecue.com'), true)
  assert.equal(isOwnInbox('info@chihua.com', 'chihuatacosusa.com'), true)
})

test('two different El Paso businesses never match on the shared prefix', () => {
  assert.equal(isOwnInbox('dave@elpasobiergarten.com', 'elpasoplumbing.com'), false)
  assert.equal(isOwnInbox('purchasingsuppliers@brinker.com', 'www.chilis.com'), false)
  assert.equal(isOwnInbox('hi@mystore.com', 'barbacoalos4vientos.square.site'), false)
})

test('a chain store-locator page is recognised as head office, not the local business', () => {
  assert.equal(isChainLocatorUrl('https://www.wingstop.com/location/wingstop-248-el-paso-tx-79902/menu?y_source=1'), true)
  assert.equal(isChainLocatorUrl('https://www.pepboys.com/stores/tx/el-paso/9345-dyer-st'), true)
  assert.equal(isChainLocatorUrl('www.mcdonalds.com/us/en-us/location/tx/el-paso/123.html'), true)
})

test("an independent business's own site is not a store locator", () => {
  assert.equal(isChainLocatorUrl('https://takotakotacos.com/'), false)
  assert.equal(isChainLocatorUrl('https://www.oaknantler.com/menu'), false)
  // "store" as part of a word, or a shop page, is not a locator.
  assert.equal(isChainLocatorUrl('https://mystorefront.com/storefront'), false)
  assert.equal(isChainLocatorUrl(undefined), false)
})
