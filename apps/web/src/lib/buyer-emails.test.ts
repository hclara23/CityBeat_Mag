import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moderationOutcomeEmail, purchaseConfirmationEmail } from './buyer-emails'

test('purchase confirmation states the price and product, in the right language(s)', () => {
  const en = purchaseConfirmationEmail({ productName: 'Jobs - 30-Day Job Posting', amountTotal: 5000, currency: 'usd', locale: 'en' })
  assert.match(en.subject, /Payment received/)
  assert.match(en.html, /\$50\.00/)
  assert.match(en.html, /30-Day Job Posting/)
  assert.equal(/Recibimos/.test(en.html), false)

  const es = purchaseConfirmationEmail({ productName: 'Ficha Premium', amountTotal: 1999, currency: 'usd', locale: 'es' })
  assert.match(es.subject, /Pago recibido/)
  assert.match(es.html, /Recibimos tu pago/)

  // Unknown locale -> BOTH languages (El Paso is ~90% Spanish-speaking;
  // guessing English-only is wrong more often than right).
  const both = purchaseConfirmationEmail({ productName: 'X', amountTotal: 999, currency: 'usd' })
  assert.match(both.subject, /Payment received \/ Pago recibido/)
  assert.match(both.html, /We received your payment/)
  assert.match(both.html, /Recibimos tu pago/)
})

test('moderation outcomes tell the buyer live-until and offer a fix path on rejection', () => {
  const live = moderationOutcomeEmail({
    itemLabel: 'Delivery Driver', kindLabelEn: 'job posting', kindLabelEs: 'oferta de empleo',
    approved: true, liveUntil: '2026-09-27T00:00:00.000Z', publicUrl: 'https://citybeatmag.co/en/jobs', locale: 'en',
  })
  assert.match(live.subject, /You're live/)
  assert.match(live.html, /2026-09-27/)
  assert.match(live.html, /citybeatmag\.co\/en\/jobs/)

  const rejected = moderationOutcomeEmail({
    itemLabel: 'Delivery Driver', kindLabelEn: 'job posting', kindLabelEs: 'oferta de empleo', approved: false,
  })
  assert.match(rejected.subject, /Changes needed \/ Necesitamos cambios/)
  assert.match(rejected.html, /refund/)
  assert.match(rejected.html, /reembolso/)
})

test('customer-supplied names cannot inject markup, and only http(s) urls render', () => {
  const nasty = purchaseConfirmationEmail({ productName: '<img src=x>', businessName: '"quote"', amountTotal: 100, currency: 'usd', locale: 'en' })
  assert.equal(/<img src=x>/.test(nasty.html), false)
  assert.match(nasty.html, /&lt;img/)
  const badUrl = moderationOutcomeEmail({
    itemLabel: 'x', kindLabelEn: 'job posting', kindLabelEs: 'oferta', approved: true,
    publicUrl: 'javascript:alert(1)', locale: 'en',
  })
  assert.equal(/javascript:/.test(badUrl.html), false)
})
