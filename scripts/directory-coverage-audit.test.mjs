import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, zip } from './directory-coverage-audit.mjs';
test('ZIP extraction excludes five-digit street numbers and accepts state-qualified ZIP+4',()=>{
  assert.equal(zip({address:'12345 Main St, El Paso, TX 79936-1234'}),'79936');
  assert.equal(zip({address:'12345 Main St'}),undefined);
  assert.equal(zip({zip:'79904',address:'12345 Main St'}),'79904');
});
test('inventory separates merged records, cities, and location arrays',()=>{
  const rows=[{name:'One',address:'1 Main St, El Paso, TX 79904',is_published:true,tier:'basic',locations:[{},{}]},
    {name:'One',address:'2 Main St, El Paso, TX 79904',is_published:false,merged_into:'a'},
    {name:'Other',address:'123 El Paso Rd, Las Cruces, NM 88001',is_published:true},
    {name:'Pending',is_published:false}];
  const r=summarize(rows);
  assert.equal(r.totalRecords,4);assert.equal(r.published,2);assert.equal(r.mergedRecords,1);
  assert.equal(r.unpublishedUnmerged,1);assert.equal(r.elPasoTextMatched,1);assert.equal(r.embeddedLocationEntries,2);
  assert.equal(Object.values(r.publishedByCategory).reduce((a,b)=>a+b),r.published);
});
test('duplicate candidates preserve distinct locations and flag same name plus address',()=>{
  const r=summarize([{name:'Shop',address:'1 Main St',is_published:true},{name:'SHOP',address:'1 Main St.',is_published:true},{name:'Shop',address:'2 Main St',is_published:true}]);
  assert.deepEqual(r.duplicateCandidates.publishedNameAddress,{groups:1,rows:2,excessRows:1});
});
