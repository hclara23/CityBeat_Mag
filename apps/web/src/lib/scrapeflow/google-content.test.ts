import test from 'node:test'
import assert from 'node:assert/strict'
import { isGoogleMapsContent } from './google-content'

// Pins the ToS bug: deliverToDirectory used to write whole Places records
// (address, lat/lng, phone, website) into the monetized directory forever,
// keyed by the real place id. These cases are the exact rows that must never
// reach Firestore again.
test('a row produced by a Places search is Google Content and must be refused', () => {
  assert.equal(
    isGoogleMapsContent({
      google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      source_url: 'https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4',
    }),
    true
  )
})

test('a real place id alone is enough — provenance does not depend on the source url', () => {
  // An AI-extracted or hand-imported row that carries a Google place id was
  // still derived from Google, even when source_url points somewhere else.
  assert.equal(
    isGoogleMapsContent({ google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4', source_url: 'https://elpasochamber.com/members' }),
    true
  )
  // …and so is a row scraped straight off a Google surface with no id at all.
  assert.equal(isGoogleMapsContent({ google_place_id: null, source_url: 'https://maps.google.com/?q=hvac' }), true)
})

test('open-data and crawled rows keep flowing — only Google provenance is refused', () => {
  // TDLR / TSBDE / chamber rows get a synthetic sf:<hash> id from normalize.ts.
  assert.equal(
    isGoogleMapsContent({ google_place_id: 'sf:9f2b1c4d5e6f7a8b9c0d1e2f', source_url: 'https://data.texas.gov/resource/7358-krk7' }),
    false
  )
  assert.equal(isGoogleMapsContent({ google_place_id: 'sf:abc123abc123', source_url: null }), false)
  // A business whose own site merely lives on a Google-adjacent lookalike domain
  // is not Google Content — the host match is anchored, not a substring.
  assert.equal(isGoogleMapsContent({ google_place_id: 'sf:abc123abc123', source_url: 'https://notgoogle.com/list' }), false)
  assert.equal(isGoogleMapsContent({ google_place_id: 'sf:abc123abc123', source_url: 'https://google.com.example.net/x' }), false)
})

test('a malformed or missing id never trips the guard on its own', () => {
  assert.equal(isGoogleMapsContent({}), false)
  assert.equal(isGoogleMapsContent({ google_place_id: '', source_url: '' }), false)
  assert.equal(isGoogleMapsContent({ google_place_id: 'short', source_url: 'not a url' }), false)
})
