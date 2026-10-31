import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {privilegedDenial} from './privileged-access'
import * as support from './support-workflow'

// Exercise the real handlers, replacing only their external boundaries. Any
// unexpected database, rate-limit, website or outbound-mail call fails loudly.
function harness(options:{signedIn?:boolean;mfa?:boolean;db?:any}={}) {
  let accesses=0
  const unexpected=()=>{accesses++;throw new Error('Unexpected side effect')}
  const modules:Record<string,any>={
    'next/server':{NextResponse:Response},
    '@citybeat/lib/firebase/server':{getServerUser:async()=>options.signedIn?{id:'staff',email:'staff@example.invalid'}:null,getServerUserProfile:async()=>({role:'admin',mfa_enabled:options.mfa,display_name:'Test Staff'})},
    '@citybeat/lib/roles':{hasAdminAccess:()=>true,hasEditorAccess:()=>true},
    '@citybeat/lib/firebase/admin':{adminDb:options.db || {collection:unexpected}},
    'firebase-admin/firestore':{FieldValue:{serverTimestamp:unexpected}},
    '@/lib/privileged-access':{privilegedDenial},
    '@/lib/support-workflow':support,
    '@/lib/auth-security':{checkRateLimit:unexpected},
    '@/lib/directory-entitlements':{resolveEntitlements:unexpected,resolveListingPatchAccess:unexpected},
    '@/lib/website-prefill':{extractWebsitePrefill:unexpected,publicWebsiteUrl:unexpected},
    '@/lib/website-prefill-fetch':{fetchPrefillPage:unexpected},
    '@/lib/postiz-promotion':{},
  }
  function load(relative:string) {
    const source=readFileSync(new URL(relative,import.meta.url),'utf8')
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
    const exported:any={}
    runInNewContext(compiled,{exports:exported,URL,process:{env:{NEXT_PUBLIC_APP_URL:'https://citybeatmag.co'}},require:(name:string)=>{
      if(!(name in modules))throw new Error(`Unexpected dependency ${name}`)
      return modules[name]
    }})
    return exported
  }
  modules['@/lib/admin-automation-auth']=load('./admin-automation-auth.ts')
  return {load,accesses:()=>accesses}
}
const mutations=[
  ['../app/api/admin/leads/route.ts','POST'],
  ['../app/api/admin/leads/[id]/route.ts','PATCH'],
  ['../app/api/admin/promotions/route.ts','POST'],
  ['../app/api/directory/[id]/prefill/route.ts','POST'],
] as const
function request(method:string,origin='https://citybeatmag.co',body:any={}) {
  return new Request('https://citybeatmag.co/api/test',{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})
}
for(const [label,signedIn,mfa,origin,status] of [
  ['anonymous',false,false,'https://citybeatmag.co',401],
  ['missing second factor',true,false,'https://citybeatmag.co',403],
  ['foreign origin',true,true,'https://attacker.example',403],
] as const) test(`advertiser mutations reject ${label} before any side effect`,async()=>{
  const h=harness({signedIn,mfa})
  for(const [file,method] of mutations){
    const response=await h.load(file)[method](request(method,origin),{params:Promise.resolve({id:'fixture'})})
    assert.equal(response.status,status,file)
  }
  assert.equal(h.accesses(),0)
})

test('support handler atomically records resolution and audit, and rejects stale updates',async()=>{
  let current:any={contact:'customer@example.invalid',status:'new',support_revision:0}
  const audit:any[]=[]
  const ref={collection:()=>({doc:()=>({audit:true})})}
  const db={collection:()=>({doc:()=>ref}),runTransaction:async(fn:any)=>{
    let patch:any,event:any
    const result=await fn({get:async()=>({exists:true,data:()=>current}),update:(_:any,data:any)=>{patch=data},set:(_:any,data:any)=>{event=data}})
    current={...current,...patch};audit.push(event);return result
  }}
  const h=harness({signedIn:true,mfa:true,db}),route=h.load('../app/api/admin/leads/[id]/route.ts')
  const body={expected_revision:0,status:'resolved',assignment:'me',note:'Customer confirmed the corrected hours.'}
  const response=await route.PATCH(request('PATCH',undefined,body),{params:Promise.resolve({id:'fixture'})})
  assert.equal(response.status,200)
  assert.equal(current.support_status,'resolved');assert.equal(current.support_assigned_to,'staff')
  assert.equal(current.contact,'customer@example.invalid');assert.equal(current.status,'new')
  assert.equal(audit.length,1);assert.equal(audit[0].actor_id,'staff');assert.equal(audit[0].previous_status,'open')
  const stale=await route.PATCH(request('PATCH',undefined,body),{params:Promise.resolve({id:'fixture'})})
  assert.equal(stale.status,409);assert.equal(audit.length,1)
})
