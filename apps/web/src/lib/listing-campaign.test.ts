import test from 'node:test'
import assert from 'node:assert/strict'
import { qrCampaignUrl, qrCampaignFromSearch, listingShortDestination } from './listing-campaign'
import { totalsForRange, statsToCsv } from './listing-analytics'
test('QR short links preserve only validated attribution and language, including OSM IDs',()=>{
  const tagged=qrCampaignUrl('https://citybeatmag.co/b/osm:123#reviews','reviews','es')
  const destination=listingShortDestination('osm:123',tagged)
  assert.equal(destination.pathname,'/es/directory/osm%3A123')
  assert.equal(qrCampaignFromSearch(destination.search),'reviews')
  assert.equal(destination.hash,'#reviews')
  assert.equal(destination.searchParams.has('redirect'),false)
  assert.equal(qrCampaignFromSearch('?utm_medium=qr&utm_campaign=unknown&utm_source=citybeat'),undefined)
  assert.equal(qrCampaignFromSearch('?utm_campaign=listing'),undefined)
  assert.equal(listingShortDestination('id','https://citybeatmag.co/b/id?lang=fr&next=https://evil.example').href,'/en/directory/id'.replace(/^/,'https://citybeatmag.co'))
})
test('QR counters remain a subset of views, separate from calls, clicks and leads in totals and CSV',()=>{
  const row={day:'2026-10-31',view:5,click_website:2,click_phone:1,qr_visit:3,qr_listing:1,qr_reviews:1,qr_social_card:1}
  const totals=totalsForRange([row],'2026-10-01','2026-10-31')
  assert.equal(totals.view,5);assert.equal(totals.qr_visit,3);assert.equal(totals.lead,0)
  assert.equal(totals.click_website,2);assert.equal(totals.click_phone,1)
  const [header,data]=statsToCsv([row]).split('\r\n').map(line=>line.split(','))
  assert.equal(data[header.indexOf('qr_tagged_visits')],'3')
  assert.equal(data[header.indexOf('phone_clicks')],'1')
  assert.equal(data[header.indexOf('leads')],'0')
})
