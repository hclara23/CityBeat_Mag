import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ENRICH_BUDGET_MS,
  ENRICH_CONCURRENCY,
  ENRICH_DEFAULT_LIMIT,
  ENRICH_MAX_LIMIT,
  ENRICH_WORST_CASE_PER_LISTING_MS,
  bestEmail,
  canStartEnrichment,
  enrichLimit,
  isChainLocatorUrl,
  isOwnInbox,
} from './enrich-contacts'

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

// --- Throughput: the budget, not the limit ------------------------------------
//
// scrapeEmail makes up to four fetches per listing at an 8s timeout each, and the
// loop was strictly sequential — so one listing can take 32s and the old default
// of 25 could want 800s against a 300s route. The ceiling of 100 was protecting a
// timeout, not expressing capacity. With ~27,000 phone-and-address-only listings
// arriving from the new Comptroller and TABC sources, 75 attempts a day was the
// bottleneck on every outbound tactic.

test('the worst case for one listing is derived, not guessed', () => {
  // If the fetch timeout or the number of paths tried ever changes, the budget
  // gate must move with it rather than silently under-reserving.
  assert.equal(ENRICH_WORST_CASE_PER_LISTING_MS, 8000 * 4)
})

test('the budget leaves room for the traversal, the writes and the response', () => {
  const routeMaxDurationMs = 300_000
  assert.ok(ENRICH_BUDGET_MS < routeMaxDurationMs)
  assert.ok(routeMaxDurationMs - ENRICH_BUDGET_MS >= 60_000, 'at least 60s of headroom')
})

test('the budget can fit several listings even at the worst case', () => {
  // A budget that only fits one would make concurrency pointless.
  assert.ok(Math.floor(ENRICH_BUDGET_MS / ENRICH_WORST_CASE_PER_LISTING_MS) >= 5)
})

test('the first listing always starts, however little budget is left', () => {
  // A run that fetches nothing and reports success is the silent-nothing
  // failure this codebase keeps having to fix.
  assert.equal(canStartEnrichment(0, 0, 1, 999_999), true)
  assert.equal(canStartEnrichment(5_000_000, 0, 1_000, 999_999), true)
})

test('a later listing only starts if it can finish', () => {
  const per = 32_000
  const budget = 230_000
  assert.equal(canStartEnrichment(0, 1, budget, per), true)
  assert.equal(canStartEnrichment(190_000, 5, budget, per), true, '40s left, needs 32s')
  assert.equal(canStartEnrichment(200_000, 6, budget, per), false, '30s left, needs 32s')
  assert.equal(canStartEnrichment(999_999, 9, budget, per), false)
})

test('a negative elapsed time cannot buy extra budget', () => {
  assert.equal(canStartEnrichment(-100_000, 1, 10_000, 32_000), false)
})

test('a junk limit falls back to the DEFAULT, never the maximum', () => {
  // "?limit=abc" quietly meaning "enrich a thousand listings" is the mistake
  // that would hurt.
  for (const bad of ['abc', '0', '-5', '', null, undefined, {}, NaN]) {
    assert.equal(enrichLimit(bad as unknown), ENRICH_DEFAULT_LIMIT, JSON.stringify(bad))
  }
})

test('a requested limit is honoured and clamped', () => {
  assert.equal(enrichLimit(300), 300)
  assert.equal(enrichLimit('300'), 300)
  assert.equal(enrichLimit(90.9), 90, 'floored')
  assert.equal(enrichLimit(999_999), ENRICH_MAX_LIMIT)
})

test('the new default is a real increase over the old timeout guard', () => {
  // The whole point: 25/run (75 candidates scanned) could not keep up with the
  // directory, let alone with ~27,000 new rows.
  assert.ok(ENRICH_DEFAULT_LIMIT >= 100, `default is ${ENRICH_DEFAULT_LIMIT}`)
  assert.ok(ENRICH_CONCURRENCY >= 2 && ENRICH_CONCURRENCY <= 10, 'polite but useful')
})
