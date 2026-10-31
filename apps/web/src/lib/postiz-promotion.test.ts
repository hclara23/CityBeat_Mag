import test from 'node:test'
import assert from 'node:assert/strict'
import {promotionDraft,postizConfiguration,postizRequest,facebookChannels,facebookSchedule} from './postiz-promotion'
const listing={name:'Sample Roofing',tier:'premium',is_published:true,address:'123 Test St, El Paso, TX 79901'}
test('promotion drafts contain only local published paid listings and a canonical contact link',()=>{
  const result=promotionDraft({listing_id:'osm:123'},listing)
  assert.match(result.caption,/Sample Roofing in El Paso/)
  assert.equal(result.url,'https://citybeatmag.co/en/directory/osm%3A123')
  for(const changed of [{tier:'basic'},{is_published:false},{publication_hold:'review'},{address:'123 Test St, Dallas, TX 75201'},{address:''}]) assert.throws(()=>promotionDraft({listing_id:'id'},{...listing,...changed}))
  assert.match(promotionDraft({listing_id:'id',locale:'es'},listing).caption,/Conoce/)
})
test('missing configuration is honestly unconfigured and unsafe endpoint settings are rejected',()=>{
  assert.equal(postizConfiguration({}),null)
  assert.equal(postizConfiguration({POSTIZ_API_KEY:'test'})!.base,'https://api.postiz.com/public/v1')
  for(const url of ['http://example.com/public/v1','https://user:secret@example.com/public/v1','https://example.com/private','https://example.com/public/v1?key=foo']) assert.throws(()=>postizConfiguration({POSTIZ_API_KEY:'test',POSTIZ_API_URL:url}))
})
test('Facebook schedule conforms to documented API contract and rejects past or distant dates',()=>{
  const now=Date.parse('2026-10-31T12:00:00Z')
  const payload=facebookSchedule('A reviewed caption','page-id','2026-11-01T09:00:00-07:00',now)
  assert.equal(payload.type,'schedule');assert.equal(payload.date,'2026-11-01T16:00:00.000Z')
  assert.deepEqual(payload.posts[0],{integration:{id:'page-id'},value:[{content:'A reviewed caption',image:[]}],settings:{__type:'facebook'}})
  for(const date of ['invalid','2026-10-31T12:01:00Z','2027-05-01T12:00:00Z']) assert.throws(()=>facebookSchedule('Caption','page-id',date,now))
  assert.deepEqual(facebookChannels([{id:'a',identifier:'facebook',name:'Page'},{id:'b',identifier:'facebook',disabled:true},{id:'c',identifier:'instagram'}]),[{id:'a',name:'Page'}])
})
test('Postiz transport never retries an uncertain submission or follows a credential-leaking redirect',async()=>{
  let calls=0
  const transport=(async(url:any,init:any)=>{calls++;assert.equal(url,'https://api.postiz.com/public/v1/posts');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'test-key');throw new Error('Timed out after possible acceptance')}) as typeof fetch
  await assert.rejects(()=>postizRequest({key:'test-key',base:'https://api.postiz.com/public/v1'},'/posts',{type:'schedule'},transport))
  assert.equal(calls,1)
})
