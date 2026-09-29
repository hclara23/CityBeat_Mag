import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isBotSubmission, looksLikeRandomToken } from './form-spam'

// Real [campaignName, notes] pairs from the junk that reached /admin/leads in
// September 2026, including the two least mixed-case ones.
const REAL_JUNK: Array<[string, string]> = [
  ['hxyTSzLnRcbFPntyRVKD', 'mzmjSZwLySJHMoPHclQBI'],
  ['sRWGURWOjqsvBaoj', 'OyUEWCHYqVlYbPqeNMBi'],
  ['aSwLitHbItWAqpSrqgfn', 'DCIEaSDAEbTNLtvdECbDCsy'],
  ['QzYTGCloVipMuwZjbvguJ', 'iLYDSYDEWOqbYwWhYs'],
  ['AGXimEsCmllRDHZGCulYsGV', 'MJHMdhiueLEryzefr'],
  ['lOqAkeooAuyIedDc', 'VCzJNcMENUjtRCPnFI'],
  ['KslfciOcqluqtsfSRzestq', 'ATdwbkIULRraBmux'],
  ['mBCyekiibumfuMGj', 'kFRkdXROYKBEfIGMjuKIJxAw'],
  ['yuibZoleOMAFSDuDfioq', 'mPNoERetCMzCxQcfm'],
  ['KmWkhludswlPCZLt', 'zviMGklMVbdvZcfokVmBznh'],
  ['pIQuwxlhlPaLbArWhLve', 'pBwLdnRrLfumqdSzHlpecvw'],
  ['ZUzVfizLdNkuymmGvqbOln', 'NYRwXaIohOutWxXtGdYGTrs'],
]

test('every real junk submission is caught', () => {
  for (const [campaignName, notes] of REAL_JUNK) {
    assert.equal(isBotSubmission({ fields: [campaignName, notes] }), true, `${campaignName} / ${notes}`)
  }
})

test('real enquiries pass', () => {
  const legit: Array<[string, string]> = [
    ['Fall menu launch', 'We want to sponsor two newsletters in October.'],
    ['ElPasoFallFest', ''],
    ['McDonaldsElPaso', 'Budget around $200'],
    ['', 'Can you send pricing for the category banner?'],
    ['Quinceañera expo', 'Hola, queremos anunciar nuestra expo.'],
    ['HVAC', ''],
    ['Grand opening', 'x'],
  ]
  for (const [campaignName, notes] of legit) {
    assert.equal(isBotSubmission({ fields: [campaignName, notes] }), false, `${campaignName} / ${notes}`)
  }
})

test('one odd field does not condemn a real sentence in the other', () => {
  assert.equal(isBotSubmission({ fields: ['hxyTSzLnRcbFPntyRVKD', 'Please call me about a banner'] }), false)
})

test('an empty form is not classed as a bot (validation handles it)', () => {
  assert.equal(isBotSubmission({ fields: ['', '  '] }), false)
})

test('a filled honeypot is always a bot', () => {
  assert.equal(isBotSubmission({ honeypot: 'http://spam.example', fields: ['Fall menu launch', 'real notes'] }), true)
})

test('ordinary words and CamelCase are not random tokens', () => {
  for (const s of [
    'Restaurant', 'McDonalds', 'ElPasoFallFest', 'McDonaldsElPaso', 'Sponsorship', 'BlackFridaySale',
    'iPhoneRepairs', 'WorldsStrongest', 'UTEPHomecoming', 'JuarezStreetTacos', 'GoToMarketPlan', 'MyElPasoBizExpo',
  ]) {
    assert.equal(looksLikeRandomToken(s), false, s)
  }
})
