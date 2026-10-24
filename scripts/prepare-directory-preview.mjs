// Read-only remote access. Generates LOCAL review artifacts, never imports.
import { Firestore } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { provenanceReview, previewOutlets } from './lib/directory-review.mjs';

async function main() {
  if(!process.env.COVERAGE_ACCESS_TOKEN) throw new Error('Supply a transient read-authorized COVERAGE_ACCESS_TOKEN.');
  const authClient = new OAuth2Client(); authClient.setCredentials({access_token:process.env.COVERAGE_ACCESS_TOKEN});
  const db=new Firestore({projectId:'kerstenblueprint',authClient});
  const snapshot=await db.collection('directory_listings').select('name','address','locations','source_url','is_published','tier','claim_status','owner_id','stripe_subscription_id','merged_into').limit(25001).get();
  if(snapshot.size>25000) throw new Error('Existing inventory exceeds safety ceiling; preview aborted.');
  const existing=snapshot.docs.map(d=>({id:d.id,...d.data()}));
  await db.terminate();
  const metadata=await fetch('https://data.texas.gov/api/views/jrea-zgmq.json',{signal:AbortSignal.timeout(30000)});
  if(!metadata.ok) throw new Error('Source metadata unavailable.');
  const meta=await metadata.json();
  if(meta.licenseId!=='PUBLIC_DOMAIN') throw new Error('Expected Public Domain license declaration changed.');
  const rows=[];
  // Ten ZIP strata, ten rows each. Reproducible convenience sample, not random
  // or representative of the whole city. No taxpayer/contact fields requested.
  const zips=['79936','79912','79925','79938','79915','79907','79904','79934','79901','79924'];
  for(const zip of zips) {
    const url=new URL('https://data.texas.gov/resource/jrea-zgmq.json');
    url.searchParams.set('$select','outlet_name,outlet_address,outlet_city,outlet_state,outlet_zip_code,outlet_naics_code');
    url.searchParams.set('$where',`outlet_state='TX' AND outlet_city='EL PASO' AND outlet_zip_code='${zip}'`);
    url.searchParams.set('$order','outlet_name,outlet_address,outlet_naics_code');url.searchParams.set('$limit','10');
    const res=await fetch(url,{signal:AbortSignal.timeout(30000)});
    if(!res.ok) throw new Error(`Source query failed: ${res.status}`);
    const batch=await res.json();if(batch.length!==10) throw new Error(`Expected 10 records for ZIP ${zip}.`);
    rows.push(...batch);
  }
  const candidates=previewOutlets(rows,existing),review=provenanceReview(existing);
  const count= (rs,key)=>rs.reduce((a,r)=>{a[r[key]]=(a[r[key]]||0)+1;return a;},{});
  const summary={observedAt:new Date().toISOString(),mode:'preview-only',productionWrites:0,
    existingRecords:existing.length,sourceUpdatedAt:new Date(meta.rowsUpdatedAt*1000).toISOString(),
    selection:'10 alphabetical outlet records in each of 10 ZIPs; convenience sample, not representative',
    candidateCount:candidates.length,decisions:count(candidates,'decision'),provenanceReasons:count(review,'reason'),
    protectedProvenanceRecords:review.filter(r=>r.protected).length,readyToPublish:0};
  const output=resolve('.tmp/directory-review-2026-10-23');await mkdir(output,{recursive:true});
  for(const [file,data] of Object.entries({'summary.json':summary,'import-preview.json':candidates,'provenance-review.json':review}))
    await writeFile(resolve(output,file),JSON.stringify(data,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({...summary,output},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
