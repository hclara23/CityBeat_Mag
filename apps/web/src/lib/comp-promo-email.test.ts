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

// --- The Founding rate in the expiry reminder ---------------------------------
//
// 99 of the 100 Founding spots were unsold while this reminder quoted $19.99 to
// the warmest prospects in the system. Offering the real best rate is the point;
// doing it without promising a spot is the constraint.

const reminderInput = {
  businessName: 'Taco Shop',
  listingUrl: 'https://citybeatmag.co/en/directory/x',
  claimUrl: 'https://citybeatmag.co/en/directory/x/claim',
  upgradeUrl: 'https://citybeatmag.co/en/directory/x/claim',
  until: '2026-12-30T00:00:00.000Z',
  unsubUrl: 'https://citybeatmag.co/api/newsletter/unsubscribe?u=t',
  postalAddress: '1 Example St, El Paso, TX',
}

test('with a Founding spot open the reminder offers the Founding rate, not full price', () => {
  const { html } = compReminderEmail({ ...reminderInput, foundingAvailable: true })
  assert.match(html, /\$9\.99/)
  assert.match(html, /Founding rate/i)
  assert.doesNotMatch(html, /stay on Premium for <strong>\$19\.99/)
})

test('the Founding offer never promises a spot', () => {
  // The sales guide rule, in the one place a customer could be told otherwise:
  // never promise availability, let checkout confirm the cap.
  const { html } = compReminderEmail({ ...reminderInput, foundingAvailable: true })
  assert.match(html, /subject to availability at checkout/i)
  assert.match(html, /sujeto a disponibilidad/i)
  assert.doesNotMatch(html, /reserved for you|guaranteed|your spot is/i)
})

test('with no Founding spot the reminder quotes the standard price and never mentions Founding', () => {
  const { html } = compReminderEmail({ ...reminderInput, foundingAvailable: false })
  assert.match(html, /\$19\.99/)
  assert.doesNotMatch(html, /\$9\.99/)
  assert.doesNotMatch(html, /Founding|Fundador/i)
})

test('an unknown availability falls back to the standard price', () => {
  // The caller resolves availability from Firestore and may fail. An undefined
  // flag must never be read as "yes" — quoting a rate we cannot honour is worse
  // than quoting a higher one we can.
  const { html } = compReminderEmail({ ...reminderInput })
  assert.match(html, /\$19\.99/)
  assert.doesNotMatch(html, /\$9\.99/)
})

test('both language halves of the reminder agree on the price', () => {
  // The English-locale email carries EN then ES. A customer who reads both must
  // not see two different prices.
  const open = compReminderEmail({ ...reminderInput, foundingAvailable: true }).html
  assert.equal((open.match(/\$9\.99/g) || []).length, 2, 'EN and ES both quote Founding')
  assert.doesNotMatch(open, /\$19\.99/)
  const closed = compReminderEmail({ ...reminderInput, foundingAvailable: false }).html
  assert.equal((closed.match(/\$19\.99/g) || []).length, 2, 'EN and ES both quote standard')
})
