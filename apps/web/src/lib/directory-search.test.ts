import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSearchIndex, searchDirectory, createDirectoryIndexCache, SEARCH_TTL_MS, type SearchRow } from './directory-search'
const row=(id:string,extra:Partial<SearchRow>={}):SearchRow=>({id,name:`Business ${id}`,is_published:true,tier:'basic',category:'Auto Repair',address:'12345 Main St, El Paso, TX 79904',...extra})
test('one search reaches records beyond the old 8000 window and ranks paid records globally',()=>{
  const rows=Array.from({length:8100},(_,i)=>row(String(i).padStart(5,'0')))
  rows.push(row('zz',{name:'Far-end Café',tier:'premium'}))
  const index=buildSearchIndex(rows)
  assert.deepEqual(searchDirectory(index,{query:'far end cafe'}).ids,['zz'])
  assert.equal(searchDirectory(index,{}).ids[0],'zz')
  const ids=[];for(let page=0;page<338;page++) ids.push(...searchDirectory(index,{page}).ids)
  assert.equal(new Set(ids).size,8101);assert.equal(ids.length,8101)
})
test('category aliases and Spanish categories match without mutating stored values',()=>{
  const rows=[row('a',{category:'Electrical Contractor'}),row('b',{category:'Auto Repair'})]
  const index=buildSearchIndex(rows)
  assert.deepEqual(searchDirectory(index,{category:'Electrical Contractors'}).ids,['a'])
  assert.deepEqual(searchDirectory(index,{query:'taller mecanico'}).ids,['b'])
  assert.equal(rows[0].category,'Electrical Contractor')
})
test('location searches include branches and never treat a street number as ZIP',()=>{
  const index=buildSearchIndex([row('a'),row('b',{address:'1 El Paso Rd, Las Cruces, NM 88001',locations:[{address:'2 X St, Socorro, TX 79927'}]})])
  assert.deepEqual(searchDirectory(index,{location:'El Paso'}).ids,['a'])
  assert.deepEqual(searchDirectory(index,{location:'79927'}).ids,['b'])
  assert.equal(searchDirectory(index,{location:'12345'}).total,0)
  assert.equal(searchDirectory(index,{location:'Las Cruces',category:'Beauty'}).total,0)
})
test('excludes unpublished and merged records; sponsorship expires and ties paginate deterministically',()=>{
  const index=buildSearchIndex([row('b',{name:'Same'}),row('a',{name:'Same'}),row('hidden',{is_published:false}),row('merged',{merged_into:'a'}),row('s',{name:'Z',is_sponsored:true,sponsored_until:'2020-01-01'})])
  assert.deepEqual(searchDirectory(index,{},new Date('2026-10-23')).ids,['a','b','s'])
  assert.equal(searchDirectory(index,{page:Infinity}).page,0)
  assert.equal(searchDirectory(index,{page:999}).page,0)
})
test('cache shares in-flight work across queries, refreshes after TTL and never caches a partial failure',async()=>{
  let calls=0,clock=0,fail=false
  const get=createDirectoryIndexCache(async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));if(fail) throw Error('offline');return [row('a')]},()=>clock)
  const [a,b]=await Promise.all([get(),get()]);assert.equal(a,b);assert.equal(calls,1)
  await get();assert.equal(calls,1)
  clock=SEARCH_TTL_MS;fail=true;await assert.rejects(get(),/offline/)
  fail=false;await get();assert.equal(calls,3)
})
test('cache reads every internal page and refuses over-capacity inventories',async()=>{
  const rows=Array.from({length:1002},(_,i)=>row(String(i).padStart(4,'0')))
  const load=async(after:string|null,limit:number)=>rows.filter(r=>!after||r.id>after).slice(0,limit)
  assert.equal((await createDirectoryIndexCache(load,Date.now,1002)()).index.length,1002)
  await assert.rejects(createDirectoryIndexCache(load,Date.now,1001)(),/capacity/)
  await assert.rejects(createDirectoryIndexCache(async()=>[row('a'),row('a')])(),/cursor/)
})

// ---------------------------------------------------------------------------
// Glued ZIP+4. TABC publishes ZIP+4 with no separator, so 983 imported rows —
// 603 of them published, all restaurants and bars — were stored as
// "El Paso, TX 799367634" and could not be found by the directory's own search
// box, which is labelled "City or ZIP code".
// ---------------------------------------------------------------------------

test('a stored glued ZIP+4 is still found by its five-digit ZIP',()=>{
  // The real stored value from a live TABC-sourced listing.
  const index=buildSearchIndex([
    row('glued',{name:'Glued Zip Cafe',category:'Restaurant',address:'1475 George Dieter Dr Ste E, El Paso, TX 799367634'}),
    row('hyphen',{name:'Hyphen Zip Freight',category:'Logistics & Freight',address:'100 Main St, El Paso, TX 79928-6569'}),
    row('plain',{name:'Plain Zip Bar',category:'Restaurant',address:'525 S Stanton St, El Paso, TX 79901'}),
  ])
  const ids=(zip:string)=>searchDirectory(index,{location:zip}).ids.sort()
  assert.deepEqual(ids('79936'),['glued'])
  assert.deepEqual(ids('79928'),['hyphen'])
  assert.deepEqual(ids('79901'),['plain'])
})

test('the ZIP+4 tail is never mistaken for a ZIP of its own',()=>{
  // '799367634' must match 79936 and nothing else — in particular not 67634 or
  // 93676, which a looser pattern would happily pick out of the same digits.
  const index=buildSearchIndex([
    row('glued',{name:'Glued Zip Cafe',category:'Restaurant',address:'1475 George Dieter Dr Ste E, El Paso, TX 799367634'}),
  ])
  for(const wrong of ['67634','93676','36763','79937']){
    assert.deepEqual(searchDirectory(index,{location:wrong}).ids,[],`${wrong} must not match a 79936 listing`)
  }
})
