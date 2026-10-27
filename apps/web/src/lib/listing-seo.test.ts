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

test('real OSM opening_hours reach the structured data, not just per-day keys', () => {
  // Chick-fil-A, live stored value. This shape is 138 of a 4,000-listing sample
  // and previously published no openingHoursSpecification whatsoever.
  assert.deepEqual(schemaOpeningHours({ opening_hours: 'Mo-Sa 06:30-22:00; Su off' }), [
    'Mo 06:30-22:00', 'Tu 06:30-22:00', 'We 06:30-22:00',
    'Th 06:30-22:00', 'Fr 06:30-22:00', 'Sa 06:30-22:00',
  ])
})

test('no hours on file publishes nothing rather than describing a business as closed', () => {
  // The empty map is 3,836 of the sample. It already produced [] here, and must
  // keep doing so — telling Google a business is shut is worse than silence.
  assert.deepEqual(schemaOpeningHours({}), [])
  assert.deepEqual(schemaOpeningHours(null), [])
  assert.deepEqual(schemaOpeningHours({ opening_hours: 'Mo-Su sunrise-sunset' }), [])
})
