// Explicit, local-only integration check. Never run against a real project.
import assert from 'node:assert/strict'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Local emulator required')
const db = getFirestore(initializeApp({projectId:'demo-citybeat-qa'}))
const collection = db.collection('directory_listings')
for(let start=0;start<8101;start+=400) {
  const batch=db.batch()
  for(let i=start;i<Math.min(start+400,8101);i++) batch.set(collection.doc(`qa-${String(i).padStart(5,'0')}`),{
    name:i===8100?'Far-end Café':`Fixture Business ${String(i).padStart(5,'0')}`,
    category:'Auto Repair',address:'123 Main St, El Paso, TX 79904',is_published:true,
    tier:i===8100?'premium':'basic',claim_status:'unclaimed',
    contact_email:'private@example.invalid',claim_token_hash:'private-token',stripe_subscription_id:'private-sub',
  })
  await batch.commit()
}
const get=async(params='')=>{
  const response=await fetch(`http://127.0.0.1:3199/api/directory?${params}`)
  assert.equal(response.status,200);return response.json()
}
const first=await get()
assert.equal(first.total,8101);assert.equal(first.listings.length,24)
assert.equal(first.listings[0].id,'qa-08100')
for(const row of first.listings) for(const field of ['contact_email','claim_token_hash','stripe_subscription_id']) assert.equal(row[field],undefined)
const found=await get('query=far%20end%20cafe&location=79904')
assert.equal(found.total,1);assert.equal(found.listings[0].id,'qa-08100')
const last=await get('page=99999')
assert.equal(last.page,337);assert.equal(last.listings.length,13);assert.equal(last.hasMore,false)
assert.equal((await get('location=88001')).total,0)
await collection.doc('qa-08100').update({is_published:false})
const hidden=await get('query=far%20end%20cafe')
assert.equal(hidden.listings.length,0);assert.equal(hidden.visibilityChanged,true)
await collection.doc('qa-08100').update({is_published:true})
console.log('PASS: emulator API pagination, global search, ZIP, private-field stripping, and live visibility recheck (8,101 synthetic records).')
await db.terminate()
