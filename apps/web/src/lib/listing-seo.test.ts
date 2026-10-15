import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePostalAddress, schemaOpeningHours, schemaTypeForCategory } from './listing-seo'

test('parses a formatted US listing address into PostalAddress fields', () => {
  assert.deepEqual(parsePostalAddress('4550 Hercules Ave, El Paso, TX 79904'), {
    '@type': 'PostalAddress', streetAddress: '4550 Hercules Ave', addressLocality: 'El Paso',
    addressRegion: 'TX', postalCode: '79904', addressCountry: 'US',
  })
})

test('normalizes opening hours and drops closed or malformed values', () => {
  assert.deepEqual(schemaOpeningHours({ Monday: '9:00 AM - 6:00 PM', Tuesday: 'Closed', Wednesday: '8 AM–12 PM' }), [
    'Mo 09:00-18:00', 'We 08:00-12:00',
  ])
})

test('maps supported categories to a specific LocalBusiness subtype', () => {
  assert.equal(schemaTypeForCategory('Auto Repair'), 'AutoRepair')
  assert.equal(schemaTypeForCategory('Unknown'), 'LocalBusiness')
})
