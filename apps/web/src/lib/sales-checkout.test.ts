import assert from 'node:assert/strict'
import test from 'node:test'
import {
  blocksReplacementSubscription,
  normalizeSalesEmail,
  oneTimeCheckoutDefaults,
  recurringAuthorizationMessage,
  recurringCheckoutDefaults,
  recurringCustomerParams,
  recurringEmailError,
  reusableStripeCustomer,
  salesCheckoutKind,
} from './sales-checkout'

test('sales checkout classifies only custom sales as one-time payments', () => {
  assert.equal(salesCheckoutKind('custom'), 'custom')
  assert.equal(salesCheckoutKind('directory'), 'directory')
  assert.equal(salesCheckoutKind('unknown'), 'directory')
  assert.equal(salesCheckoutKind(undefined), 'directory')
})

test('recurring checkout requires and normalizes a valid customer email', () => {
  assert.equal(normalizeSalesEmail('  Owner@Business.COM '), 'owner@business.com')
  assert.equal(recurringEmailError('directory', ''), 'Client email is required for recurring billing')
  assert.equal(
    recurringEmailError('directory', 'owner-at-business.com'),
    'Enter a valid client email for recurring billing'
  )
  assert.equal(recurringEmailError('directory', 'owner@business.com'), null)
  assert.equal(recurringEmailError('custom', ''), null)
})

test('all non-terminal Stripe subscription states block replacement billing', () => {
  for (const status of ['incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused']) {
    assert.equal(blocksReplacementSubscription(status), true, status)
  }
  assert.equal(blocksReplacementSubscription('canceled'), false)
  assert.equal(blocksReplacementSubscription('incomplete_expired'), false)
  assert.equal(blocksReplacementSubscription(undefined), true)
  assert.equal(blocksReplacementSubscription('unexpected_future_status'), true)
})

test('saved Stripe customers are reused only for the same normalized listing email', () => {
  assert.equal(
    reusableStripeCustomer({
      customerId: 'cus_ABC123',
      listingEmail: 'Owner@Business.com',
      contactEmail: 'owner@business.com',
    }),
    'cus_ABC123'
  )
  assert.equal(
    reusableStripeCustomer({
      customerId: 'cus_ABC123',
      listingEmail: 'previous@business.com',
      contactEmail: 'new@business.com',
    }),
    null
  )
  assert.equal(
    reusableStripeCustomer({
      customerId: 'not-a-stripe-customer',
      listingEmail: 'owner@business.com',
      contactEmail: 'owner@business.com',
    }),
    null
  )
})

test('recurring customer parameters prefill a matched saved card or a first-time email', () => {
  assert.deepEqual(
    recurringCustomerParams({
      customerId: 'cus_RETURNING123',
      listingEmail: 'owner@business.com',
      contactEmail: 'owner@business.com',
    }),
    {
      customer: 'cus_RETURNING123',
      customer_update: { address: 'auto', name: 'auto' },
    }
  )
  assert.deepEqual(
    recurringCustomerParams({
      customerId: 'cus_DIFFERENT123',
      listingEmail: 'old@business.com',
      contactEmail: ' NEW@BUSINESS.COM ',
    }),
    { customer_email: 'new@business.com' }
  )
})

test('recurring authorization copy states the price, cadence, and cancellation boundary', () => {
  assert.equal(
    recurringAuthorizationMessage('$19.99 / mo', 'month'),
    'By subscribing, you authorize CityBeat to charge this payment method $19.99 / mo each month until canceled.'
  )
  assert.equal(
    recurringAuthorizationMessage('$199 / yr', 'year'),
    'By subscribing, you authorize CityBeat to charge this payment method $199 / yr each year until canceled.'
  )
})

test('Stripe session defaults separate automatic renewals from one-time card charges', () => {
  assert.deepEqual(recurringCheckoutDefaults('$19.99 / mo', 'month'), {
    mode: 'subscription',
    payment_method_types: ['card'],
    payment_method_collection: 'always',
    billing_address_collection: 'auto',
    locale: 'auto',
    custom_text: {
      submit: {
        message:
          'By subscribing, you authorize CityBeat to charge this payment method $19.99 / mo each month until canceled.',
      },
    },
  })
  assert.deepEqual(oneTimeCheckoutDefaults(), {
    mode: 'payment',
    payment_method_types: ['card'],
    billing_address_collection: 'auto',
    locale: 'auto',
  })
  assert.equal('payment_method_collection' in oneTimeCheckoutDefaults(), false)
})
