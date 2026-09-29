import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compGrantEmail, compReminderEmail, formatCompDate } from './comp-promo-email'

const base = {
  businessName: 'Tako Tako Tacos',
  listingUrl: 'https://citybeatmag.co/en/directory/abc',
  claimUrl: 'https://citybeatmag.co/en/directory/abc/claim',
  until: '2026-12-30T12:00:00.000Z',
  unsubUrl: 'https://citybeatmag.co/api/newsletter/unsubscribe?u=tok',
  postalAddress: '330 Bartlett Dr Apt 1008, El Paso, TX 79912',
}

test('the grant email states every term, in both languages', () => {
  const { subject, html } = compGrantEmail(base)
  assert.match(subject, /3 months of CityBeat Premium, free/)
  assert.match(html, /No card needed and nothing is billed/)
  assert.match(html, /No pedimos tarjeta y no se cobra nada/)
  assert.match(html, /December 30, 2026/)
  assert.match(html, /returns to the free Basic plan/)
  assert.ok(html.includes(base.claimUrl), 'claim link')
  assert.ok(html.includes(base.listingUrl), 'listing link')
})

test('every email carries the postal address and an unsubscribe link (CAN-SPAM)', () => {
  for (const { html } of [compGrantEmail(base), compReminderEmail({ ...base, upgradeUrl: 'https://x/up' })]) {
    assert.ok(html.includes(base.postalAddress))
    assert.ok(html.includes(base.unsubUrl.replace(/&/g, '&amp;')))
  }
})

test('Spanish-locale recipients get Spanish only', () => {
  const { subject, html } = compGrantEmail({ ...base, locale: 'es' })
  assert.match(subject, /3 meses de Premium gratis/)
  assert.doesNotMatch(html, /No card needed/)
})

test('a business name cannot inject markup', () => {
  const { html } = compGrantEmail({ ...base, businessName: '<script>x</script>' })
  assert.doesNotMatch(html, /<script>/)
})

test('the reminder says nothing is charged and names the real price to continue', () => {
  const { html } = compReminderEmail({ ...base, upgradeUrl: 'https://x/up' })
  assert.match(html, /won't be charged anything/)
  assert.match(html, /\$19\.99\/month/)
})

test('dates render in El Paso time', () => {
  // 03:00 UTC on the 31st is still the 30th in El Paso.
  assert.equal(formatCompDate('2026-12-31T03:00:00Z', 'en'), 'December 30, 2026')
})
