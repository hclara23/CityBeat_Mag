import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import { qrCampaignUrl, qrCampaignFromSearch, listingShortDestination } from './listing-campaign'
import { totalsForRange, statsToCsv } from './listing-analytics'

test('QR route never redirects visitors to the Cloud Run internal host',async()=>{
  const source=readFileSync(new URL('../app/b/[id]/route.ts',import.meta.url),'utf8')
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const exported:any={}
  runInNewContext(compiled,{exports:exported,require:(name:string)=>{
    if(name==='next/server')return {NextResponse:Response}
    if(name==='@/lib/listing-campaign')return {listingShortDestination}
    throw new Error(`Unexpected dependency ${name}`)
  }})
  const request={url:'https://0.0.0.0:8080/b/osm:123?utm_source=citybeat&utm_medium=qr&utm_campaign=reviews&lang=es'}
  const response=await exported.GET(request,{params:Promise.resolve({id:'osm:123'})})
  assert.equal(response.status,302)
  assert.equal(response.headers.get('location'),'/es/directory/osm%3A123?utm_source=citybeat&utm_medium=qr&utm_campaign=reviews#reviews')
  assert.equal(response.headers.get('cache-control'),'no-store')
  const invalid=await exported.GET(request,{params:Promise.resolve({id:'../../bad'})})
  assert.equal(invalid.headers.get('location'),'/en/directory')
})
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
