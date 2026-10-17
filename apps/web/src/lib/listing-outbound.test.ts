import assert from 'node:assert/strict'
import test from 'node:test'
import { attributedListingUrl, listingPhoneHref } from './listing-outbound'

test('adds CityBeat attribution while preserving destination query and hash', () => {
  const result = new URL(attributedListingUrl('https://shop.example/book?service=oil#times', 'listing-1', 'action_booking'))
  assert.equal(result.searchParams.get('service'), 'oil')
  assert.equal(result.searchParams.get('utm_source'), 'citybeatmag.co')
  assert.equal(result.searchParams.get('utm_medium'), 'referral')
  assert.equal(result.searchParams.get('utm_campaign'), 'directory_action_booking')
  assert.equal(result.searchParams.get('utm_content'), 'listing-1')
  assert.equal(result.hash, '#times')
})

test('does not overwrite destination attribution and leaves non-http links alone', () => {
  const result = new URL(attributedListingUrl('https://example.com/?utm_source=owner', 'abc', 'website'))
  assert.equal(result.searchParams.get('utm_source'), 'owner')
  assert.equal(attributedListingUrl('tel:+19155550100', 'abc', 'website'), 'tel:+19155550100')
  assert.equal(attributedListingUrl('not a url', 'abc', 'website'), 'not a url')
})

test('builds safe telephone links and rejects values without digits', () => {
  assert.equal(listingPhoneHref('(915) 202-6730'), 'tel:9152026730')
  assert.equal(listingPhoneHref('+1 915 336 7080'), 'tel:+19153367080')
  assert.equal(listingPhoneHref('not listed'), null)
  assert.equal(listingPhoneHref(null), null)
})
