import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BILLING_TERMS_EN,
  BILLING_TERMS_ES,
  billingTerms,
  billingTermsShort,
} from './billing-terms'

// Copy tests, for the same reason the payout policy has them: this is the text a
// customer is shown before we start charging their card every month, and the
// failure mode is somebody tidying it and quietly deleting the disclosure. If one
// of these breaks, do not delete the assertion — restore the sentence.

test('both languages disclose that the price repeats', () => {
  assert.match(BILLING_TERMS_EN.renewal, /renews automatically/i)
  assert.match(BILLING_TERMS_ES.renewal, /se renueva autom/i)
})

test('both languages say how to stop it', () => {
  // "Easy cancellation" means naming where the button is, not "contact us".
  assert.match(BILLING_TERMS_EN.cancel, /cancel any time/i)
  assert.match(BILLING_TERMS_EN.cancel, /billing/i)
  assert.match(BILLING_TERMS_ES.cancel, /cancela cuando quieras/i)
  assert.match(BILLING_TERMS_ES.cancel, /facturaci/i)
})

test('both languages say what cancelling actually does', () => {
  // It must match handleSubscriptionDeleted: charges stop, the paid period is
  // honoured, then the listing drops to the free Basic tier.
  assert.match(BILLING_TERMS_EN.whatHappens, /basic/i)
  assert.match(BILLING_TERMS_ES.whatHappens, /b[áa]sico/i)
  for (const terms of [BILLING_TERMS_EN, BILLING_TERMS_ES]) {
    assert.ok(terms.refunds.includes('hello@citybeatmag.co'), 'a refund needs a real address to write to')
  }
})

test('locale selection defaults to English for anything unknown', () => {
  assert.equal(billingTerms('es'), BILLING_TERMS_ES)
  assert.equal(billingTerms('en'), BILLING_TERMS_EN)
  assert.equal(billingTerms(undefined), BILLING_TERMS_EN)
  assert.equal(billingTerms('fr'), BILLING_TERMS_EN)
})

test('the short form still states both facts, and matches the real interval', () => {
  const monthly = billingTermsShort('en', 'month')
  const yearly = billingTermsShort('en', 'year')
  assert.match(monthly, /monthly/i)
  assert.match(yearly, /yearly/i)
  // An annual plan described as renewing "monthly" is worse than saying nothing.
  assert.equal(/monthly/i.test(yearly), false)
  for (const line of [monthly, yearly, billingTermsShort('es', 'month'), billingTermsShort('es', 'year')]) {
    assert.match(line, /cancel|cancela/i, 'every short form must still say how to stop it')
  }
  assert.match(billingTermsShort('es', 'year'), /cada año/i)
  assert.match(billingTermsShort('es', 'month'), /cada mes/i)
})
