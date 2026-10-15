import assert from 'node:assert/strict'
import test from 'node:test'
import { attributedListingUrl } from './listing-outbound'

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
