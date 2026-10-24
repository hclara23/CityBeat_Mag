import assert from 'node:assert/strict'
const origin=process.argv[2]
if(!origin?.startsWith('https://')) throw Error('HTTPS origin required')
async function get(path) {
  const started=Date.now(),response=await fetch(origin+path,{signal:AbortSignal.timeout(45000)})
  assert.equal(response.status,200,path)
  const result=await response.json()
  console.log(`${path}: 200 (${Date.now()-started}ms)`)
  return result
}
const health=await get('/api/health')
assert.equal(health.status,'healthy')
const first=await get('/api/directory?page=0')
assert.equal(first.page,0);assert.equal(first.searchLimited,false)
assert.ok(first.total>8000);assert.equal(first.listings.length,24)
assert.ok(first.indexUpdatedAt);assert.equal(first.pageCount,Math.ceil(first.total/24))
const second=await get('/api/directory?page=1')
assert.equal(second.page,1)
assert.ok(second.listings.every(r=>!first.listings.some(a=>a.id===r.id)))
const last=await get('/api/directory?page=999999')
assert.equal(last.page,last.pageCount-1);assert.equal(last.hasMore,false)
const empty=await get('/api/directory?query=zzzznonexistentdirectoryverificationzzzz')
assert.equal(empty.total,0);assert.equal(empty.listings.length,0)
const named=await get('/api/directory?query=Super%20H&location=79904')
assert.ok(named.listings.some(r=>/super\s*h/i.test(r.name)))
for(const result of [first,second,last,named]) for(const row of result.listings) {
  assert.equal(row.is_published,true);assert.ok(!row.merged_into)
  for(const field of ['contact_email','email','claim_token_hash','stripe_subscription_id','manager_ids']) assert.equal(row[field],undefined)
}
console.log(JSON.stringify({revision:health.revision,total:first.total,pages:first.pageCount,referenceId:named.listings.find(r=>/super\s*h/i.test(r.name)).id}))
console.log('PASS: directory release checks; no listing or payment mutations.')
