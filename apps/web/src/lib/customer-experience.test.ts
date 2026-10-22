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

test('the premium results panel shows measured figures, not invented ones', () => {
  // It used to hardcode "14" customer actions split 6/4/3/1 behind an
  // "Illustrative example" label. Honest about being fiction — but the page's
  // argument is that Premium gives an owner REAL measurement, so illustrating
  // that with made-up numbers undercut the product being sold, and a prospect
  // who later compared it to their own dashboard would learn that CityBeat's
  // published numbers mean nothing.
  const page = source('app/[locale]/premium/page.tsx')
  assert.match(page, /getPremiumProof/, 'the panel must read real listing_stats')
  assert.doesNotMatch(page, /Illustrative example/i, 'the invented-figure disclaimer is obsolete')
  assert.doesNotMatch(page, /Ejemplo ilustrativo/i)
  // The panel must be conditional: no proof means no panel, never zeros.
  assert.match(page, /proof && \(/, 'the panel has to be omitted when there is no proof')

  // And the claim it carries must stay honest about variability.
  assert.match(page, /Results vary by business and category|Los resultados var/)

  // The reader must not be able to identify whose numbers these are. A paying
  // customer did not agree to have their performance advertised.
  assert.doesNotMatch(
    source('lib/premium-proof-server.ts'),
    /business_name/,
    'the proof reader must never pull an identifying field'
  )
  assert.match(page, /sampleSize/, 'the panel must disclose it is a median across a sample')
})

test('the public plan comparison names every capability Premium actually grants', () => {
  // The drift this pins: /premium is the page a business reads before paying,
  // and its paid list is hand-written prose while the entitlements it describes
  // live in directory-entitlements.ts. The two silently disagreed — PREMIUM
  // granted `video: true` and `aiAssistance: true` and the page mentioned
  // neither, so customers were paying for two features nobody told them about.
  // Under-promising is not a safe default here: an owner who never learns they
  // can upload a video gets less from the plan and is likelier to cancel.
  const comparison = source('components/citybeat/DirectoryPlanComparison.tsx')
  const entitlements = source('lib/directory-entitlements.ts')

  // Only assert on capabilities PREMIUM really has, read from the registry, so
  // this test follows the product rather than freezing today's feature set.
  const premium = entitlements.slice(
    entitlements.indexOf('const PREMIUM:'),
    entitlements.indexOf('const FEATURED:')
  )
  const granted = (flag: string) => premium.includes(`${flag}: true`)

  // One probe per capability: a word the copy must contain in each language.
  const probes: Array<[string, RegExp, RegExp]> = [
    ['enhancedDescription', /description/i, /descripci/i],
    ['video', /video/i, /video/i],
    ['socialLinks', /social links/i, /redes sociales/i],
    ['servicesAndProducts', /products/i, /productos/i],
    ['postsOffersEvents', /posts/i, /publicaciones/i],
    ['fullAnalytics', /analytics/i, /anal[ií]ticas/i],
    ['analyticsExport', /CSV/i, /CSV/i],
    ['detailedLeads', /contact details/i, /contacto/i],
    ['aiAssistance', /AI assistance/i, /IA/],
    ['bookingLinks', /action buttons/i, /botones de acci/i],
  ]

  // The two paidFeatures arrays, in source order: English then Spanish.
  const blocks = comparison.split('paidFeatures: [').slice(1).map((part) => part.slice(0, part.indexOf(']')))
  assert.equal(blocks.length, 2, 'expected an English and a Spanish paid feature list')
  const [en, es] = blocks

  for (const [flag, enPattern, esPattern] of probes) {
    if (!granted(flag)) continue
    assert.match(en, enPattern, `Premium grants ${flag} but the English paid list never mentions it`)
    assert.match(es, esPattern, `Premium grants ${flag} but the Spanish paid list never mentions it`)
  }

  // Quantities, which are the easiest thing to leave stale after a change.
  if (premium.includes('mediaLimit: 15')) {
    assert.match(en, /15 photos/i)
    assert.match(es, /15 fotos/i)
  }
  if (premium.includes('additionalManagers: 3')) {
    assert.match(en, /3 additional managers/i)
    assert.match(es, /3 administradores/i)
  }

  // And the other direction: the page must not sell Featured-only perks as
  // Premium. It currently says so explicitly, which is the honest framing.
  assert.match(comparison, /belong to the Featured plan|pertenecen al plan Destacado/)
  assert.doesNotMatch(en, /guaranteed top|top of your category/i)
})
