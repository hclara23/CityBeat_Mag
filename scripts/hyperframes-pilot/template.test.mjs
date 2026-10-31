import test from 'node:test'
import assert from 'node:assert/strict'
import {promotionHtml,validatePromotion} from './template.mjs'
const sample={name:'Example Auto Care',city:'El Paso',url:'https://citybeatmag.co/b/osm:123',services:['Repairs'],phone:'9155550100'}
test('video templates reject outside localities and external or unsafe destinations',()=>{
  assert.throws(()=>validatePromotion({...sample,city:'Dallas'}))
  for(const url of ['https://evil.example/','javascript:alert(1)','https://user:pass@citybeatmag.co/b/id','https://citybeatmag.co/admin'])assert.throws(()=>validatePromotion({...sample,url}))
  assert.equal(new URL(validatePromotion(sample).url).searchParams.get('utm_campaign'),'social-card')
})
test('template escapes source text, stays self-contained and preserves a review label',async()=>{
  const html=await promotionHtml({...sample,name:'<script>bad()</script>'})
  assert.equal(html.includes('<script>bad()</script>'),false)
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'))
  assert.ok(html.includes('DRAFT · NOT PUBLISHED'))
  assert.ok(html.includes('data-width="1080" data-height="1920"'))
  assert.ok(html.includes("window.__timelines['citybeat-local']=tl"))
  assert.equal(/(?:src|href)="https?:/.test(html),false)
})
