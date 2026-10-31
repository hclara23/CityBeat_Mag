import test from 'node:test'
import assert from 'node:assert/strict'
import {supportPatch,supportSummary,SupportError} from './support-workflow'
const actor={id:'staff',name:'Staff Member'}
test('legacy requests remain open and unassigned without a data migration',()=>{
  assert.equal(supportSummary({}).support_status,'open')
  assert.equal(supportSummary({}).support_revision,0)
  assert.equal(supportSummary({}).support_assigned_to,null)
})
test('claim and resolve require accountability and preserve unrelated customer fields',()=>{
  const current={contact:'customer@example.com',status:'new',owner_status:'contacted'}
  const patch=supportPatch({expected_revision:0,status:'in_progress',assignment:'me',note:'Reviewing billing.'},current,actor,'2026-10-31T10:00:00Z')
  assert.equal(patch.support_assigned_to,'staff');assert.equal(patch.support_revision,1)
  assert.equal('contact' in patch,false);assert.equal('owner_status' in patch,false);assert.equal('status' in patch,false)
  assert.throws(()=>supportPatch({expected_revision:1,status:'resolved',assignment:'keep',note:''},patch,actor),/resolution note/)
  const resolved=supportPatch({expected_revision:1,status:'resolved',assignment:'keep',note:'Customer confirmed access.'},patch,actor,'2026-10-31T11:00:00Z')
  assert.equal(resolved.support_resolved_at,'2026-10-31T11:00:00Z')
  const reopened=supportPatch({expected_revision:2,status:'open',assignment:'keep',note:'Customer needs another change.'},resolved,actor)
  assert.equal(reopened.support_resolved_at,null)
})
test('stale edits, unknown assignments, unassigned resolutions and oversized notes fail closed',()=>{
  assert.throws(()=>supportPatch({expected_revision:0,status:'open',assignment:'me'}, {support_revision:1},actor),(e:unknown)=>e instanceof SupportError&&e.status===409)
  for(const input of [{status:'resolved',assignment:'unassigned',note:'Issue resolved.'},{status:'fake',assignment:'me'},{status:'open',assignment:'another-user'},{status:'open',assignment:'me',note:'x'.repeat(2001)}]) assert.throws(()=>supportPatch({expected_revision:0,...input},{},actor))
})
