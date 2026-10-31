import test from 'node:test'
import assert from 'node:assert/strict'
import { publicIpv4, publicWebsiteUrl, extractWebsitePrefill } from './website-prefill'
test('prefill rejects private, credentialed, non-HTTPS and map URLs',()=>{
  for(const url of ['http://example.com','https://127.0.0.1','https://[::1]','https://x.internal','https://user:pass@example.com','https://example.com:8443','https://maps.google.com']) assert.throws(()=>publicWebsiteUrl(url),url)
  assert.equal(publicWebsiteUrl('https://business.example.com/about?secret=abc#x').href,'https://business.example.com/about')
})
test('only public IPv4 destinations may be pinned, including after redirects',()=>{
  for(const ip of ['0.0.0.0','10.0.0.1','127.1.2.3','169.254.169.254','172.16.0.1','172.31.255.255','192.168.1.1','100.64.0.1','100.127.255.255','192.0.2.1','198.18.0.1','203.0.113.3','224.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1']) assert.equal(publicIpv4(ip),false,ip)
  assert.equal(publicIpv4('1.1.1.1'),true)
  assert.equal(publicIpv4('8.8.8.8'),true)
})
test('extracts only evidenced fields and refuses out-of-area addresses',()=>{
  const business={ '@type':'RoofingContractor', name:'Test Roofing',telephone:'(915) 555-0100',address:{streetAddress:'123 Test Ave',addressLocality:'El Paso',addressRegion:'TX',postalCode:'79901'} }
  const html=`<meta name="description" content="Local roof repairs."><script type="application/ld+json">${JSON.stringify(business)}</script>`
  const result=extractWebsitePrefill(html,'https://example.com/')
  assert.equal(result.fields.name,'Test Roofing');assert.equal(result.fields.phone,'(915) 555-0100')
  assert.equal(result.fields.address,'123 Test Ave, El Paso, TX 79901');assert.equal(result.review_required,true)
  assert.equal(extractWebsitePrefill(html.replace('El Paso','Dallas'),'https://example.com/').fields.address,undefined)
  assert.deepEqual(extractWebsitePrefill('<p>No business facts here.</p>','https://example.com/').fields,{website:'https://example.com/'})
})
test('does not choose between different businesses or phone numbers',()=>{
  const html='<script type="application/ld+json">[{"@type":"Organization","name":"One","telephone":"9155550100"},{"@type":"Organization","name":"Two","telephone":"9155550200"}]</script><a href="tel:9155550100">One</a><a href="tel:9155550200">Two</a>'
  const result=extractWebsitePrefill(html,'https://example.com/')
  assert.equal(result.fields.name,undefined);assert.equal(result.fields.phone,undefined)
})
