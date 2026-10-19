import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { localizedReturnPath, cleanListingText, formatEventTime } from './customer-experience'
import { customerActionTotal } from './premium-value'
import { summarizeListingStats, statsToCsv } from './listing-analytics'

test('login returns localize once and preserve query and fragment', () => {
  for (const locale of ['en', 'es']) {
    assert.equal(localizedReturnPath(locale, '/directory/abc/claim?plan=founding#reviews'), `/${locale}/directory/abc/claim?plan=founding#reviews`)
    assert.equal(localizedReturnPath(locale, `/${locale}/directory/abc`), `/${locale}/directory/abc`)
    assert.equal(localizedReturnPath(locale, '/en/es/directory/abc'), `/${locale}/directory/abc`)
  }
})
test('external and ambiguous return paths use the role destination', () => {
  for (const path of ['//evil.test', '/\\evil.test', 'https://evil.test', '/%2Fevil.test', '/\nevil.test', null]) {
    assert.equal(localizedReturnPath('en', path, '/editor'), '/en/editor')
  }
})
test('events use venue timezone across UTC date rollover and DST', () => {
  assert.match(formatEventTime('2026-10-19T02:00:00.000Z', 'en'), /October 18.*8:00 PM MDT/)
  assert.match(formatEventTime('2026-12-19T02:00:00.000Z', 'en'), /December 18.*7:00 PM MST/)
  assert.match(formatEventTime('2026-10-19T02:00:00.000Z', 'en', 'America/New_York'), /10:00 PM EDT/)
  assert.equal(formatEventTime('bad', 'en'), '')
})
test('imported address glyphs are removed without losing accented text', () => {
  assert.equal(cleanListingText('\uE0C8 4550 Hércules Ave '), '4550 Hércules Ave')
  assert.equal(cleanListingText(null), '')
})
test('phone clicks reconcile headline, series and CSV without counting completed calls', () => {
  const summary = summarizeListingStats([{ day: '2026-10-19', click_phone: 4, click_website: 2, click_directions: 1, click_action: 3, lead: 1 }], new Date('2026-10-19T12:00:00Z'), 30)
  assert.equal(summary.current.click_phone, 4)
  assert.equal(summary.series.at(-1)?.clicks, 10)
  assert.equal(customerActionTotal({ phone: 4, website: 2, directions: 1, actions: 3, leads: 1 }), 11)
  assert.match(statsToCsv([{ day: '2026-10-19', click_phone: 4 }]), /phone/)
})
const source = (path: string) => readFileSync(`src/${path}`, 'utf8')
test('public UI guards: basic details, shared reviews, user-initiated chat and honest claims', () => {
  const directory = source('app/[locale]/directory/DirectoryPageClient.tsx')
  assert.match(directory.slice(directory.indexOf('Basic Listings Section')), /<Link href=\{`\/\$\{locale\}\/directory\/\$\{listing.id\}`\}/)
  assert.doesNotMatch(directory, /DirectoryPlanComparison/)
  assert.match(directory, /Result pages/)
  const detail = source('app/[locale]/directory/[id]/DirectoryDetailClient.tsx')
  assert.match(detail, /id="reviews"/)
  assert.equal(detail.split('{communityContent}').length - 1, 2)
  assert.doesNotMatch(source('components/citybeat/ChatWidget.tsx'), /3500|cb_chat_greeted/)
  assert.doesNotMatch(source('app/[locale]/ads/page.tsx'), /50,000/)
  assert.match(source('app/[locale]/directory/[id]/claim/page.tsx'), /userProfile && upgradeChosen/)
  assert.match(source('components/citybeat/QuoteForm.tsx'), /response is not guaranteed/)
})
