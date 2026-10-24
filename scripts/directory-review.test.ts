import test from 'node:test';
import assert from 'node:assert/strict';
import { previewOutlets, provenanceReview } from './lib/directory-review.mjs';
const outlet={outlet_name:'Example',outlet_address:'123 Main Street',outlet_city:'EL PASO',outlet_state:'TX',outlet_zip_code:'79904',outlet_naics_code:'811111'};
test('preview matches normalized locations, protects owners, never offers automatic patches',()=>{
  const result=previewOutlets([{...outlet,taxpayer_number:'secret',taxpayer_name:'private'}],[{id:'a',name:'Example',address:'123 Main St, El Paso, TX 79904',owner_id:'private-owner'}]);
  assert.equal(result[0].decision,'match_existing');assert.equal(result[0].protectExisting,true);
  assert.equal(result[0].automaticPatch,null);assert.equal(result[0].readyToPublish,false);
  assert.doesNotMatch(JSON.stringify(result),/secret|private-owner|taxpayer/);
});
test('preview treats shared names, suites and branch locations conservatively',()=>{
  const existing=[{id:'a',name:'Example',address:'9 Another St, El Paso, TX 79904',locations:[{address:'123 Main St, El Paso, TX 79904'}]}];
  assert.equal(previewOutlets([outlet],existing)[0].decision,'match_existing');
  assert.equal(previewOutlets([{...outlet,outlet_address:'123 Main St Suite 2'}],existing)[0].decision,'review_possible_match');
});
test('preview rejects nonlocal and mailbox addresses, flags repeat candidates',()=>{
  assert.equal(previewOutlets([{...outlet,outlet_city:'Las Cruces'}],[])[0].decision,'reject');
  assert.equal(previewOutlets([{...outlet,outlet_address:'PO Box 99'}],[])[0].decision,'reject');
  assert.equal(previewOutlets([outlet,outlet],[])[1].decision,'duplicate_in_preview');
});
test('provenance review never deletes or relabels sources and recognizes protected records',()=>{
  const result=provenanceReview([{id:'1',is_published:true,source_url:'https://www.google.com/maps/place/x',tier:'premium'},
    {id:'2',is_published:true,source_url:'https://google.com.example.org/'},{id:'3',is_published:false}]);
  assert.equal(result.length,1);assert.equal(result[0].protected,true);assert.equal(result[0].delete,false);
  assert.equal(result[0].unpublish,false);assert.equal(result[0].automaticPatch,null);
});
