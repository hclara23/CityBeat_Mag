// Read-only inventory. No Firestore writes, no raw listing/contact export.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Firestore } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import { pathToFileURL } from 'node:url';

const norm = v => String(v || '').normalize('NFKD').replace(/[\u0300-\u036f\uE000-\uF8FF]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const present = v => typeof v === 'string' && v.trim().length > 0;
const tally = (rows, fn) => Object.fromEntries(Object.entries(rows.reduce((out, row) => {
  const key = String(fn(row) || '(missing)'); out[key] = (out[key] || 0) + 1; return out;
}, {})).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])));
export const zip = r => String(r.zip || r.postal_code || '').match(/^\s*(\d{5})(?:-\d{4})?\s*$/)?.[1]
  || String(r.address || '').match(/\b(?:TX|Texas|NM|New Mexico)\s*,?\s*(\d{5})(?:-\d{4})?\b/i)?.[1];
const epText = r => norm(r.city)==='el paso' || /(?:^|,)\s*el paso\s*,?\s*(?:TX|Texas)\b/i.test(String(r.address||'').replace(/[\uE000-\uF8FF]/g,''));
function duplicates(rows, key) {
  const groups = new Map();
  for (const r of rows) { const k = key(r); if (k) groups.set(k, (groups.get(k)||0)+1); }
  const sizes = [...groups.values()].filter(n=>n>1);
  return { groups: sizes.length, rows: sizes.reduce((a,b)=>a+b,0), excessRows: sizes.reduce((a,b)=>a+b-1,0) };
}
export function summarize(rows) {
  const published = rows.filter(r=>r.is_published === true);
  const unmerged = rows.filter(r=>!r.merged_into);
  const ep = published.filter(epText);
  const source = r => r.source || (String(r.google_place_id || r.id).startsWith('osm:') ? 'osm-id-inferred' : '(missing)');
  const fields = ['name','address','phone','website','description','category','source_url'];
  const missing = rs => Object.fromEntries(fields.map(k=>[k,rs.filter(r=>!present(r[k])).length]));
  const nameAddress = r => present(r.name) && present(r.address) ? `${norm(r.name)}|${norm(r.address)}` : '';
  const namePhone = r => {
    const p = String(r.phone||'').replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');
    return present(r.name) && p.length === 10 ? `${norm(r.name)}|${p}` : '';
  };
  return {
    totalRecords: rows.length, published: published.length,
    unpublished: rows.length-published.length, mergedRecords: rows.filter(r=>r.merged_into).length,
    unpublishedUnmerged: unmerged.filter(r=>r.is_published!==true).length,
    publishedMergedAnomaly: published.filter(r=>r.merged_into).length,
    publishedByTier: tally(published,r=>r.tier), publishedByClaimStatus: tally(published,r=>r.claim_status),
    publishedBySource: tally(published,source), publishedByCategory: tally(published,r=>r.category),
    elPasoTextMatched: ep.length, otherOrUnresolvedLocation: published.length-ep.length,
    elPasoTextMatchedByCategory: tally(ep,r=>r.category), publishedByZip: tally(published,zip),
    elPasoTextMatchedByZip: tally(ep,zip), missingPublished: missing(published), missingElPasoTextMatched: missing(ep),
    publishedWithCoordinates: published.filter(r=>typeof r.latitude==='number' && typeof r.longitude==='number').length,
    publishedWithHours: published.filter(r=>r.hours && Object.keys(r.hours).length>0).length,
    publishedWithMedia: published.filter(r=>present(r.image_url)||(Array.isArray(r.gallery_urls)&&r.gallery_urls.length>0)).length,
    publishedWithLocationsArray: published.filter(r=>Array.isArray(r.locations)&&r.locations.length>0).length,
    embeddedLocationEntries: published.reduce((n,r)=>n+(Array.isArray(r.locations)?r.locations.length:0),0),
    duplicateCandidates: { publishedNameAddress: duplicates(published,nameAddress), unmergedNameAddress: duplicates(unmerged,nameAddress), publishedNamePhone: duplicates(published,namePhone) },
    sourceHosts: tally(published,r=>{try{return new URL(r.source_url).hostname}catch{return '(missing/invalid)'}}),
    publishedUpdatedMonth: tally(published,r=>typeof r.updated_at==='string'?r.updated_at.slice(0,7):r.updated_at?.toDate?.().toISOString().slice(0,7)),
    limitations: ['El Paso city field or comma-delimited El Paso TX locality match is not municipal-boundary verification.', 'ZIP requires explicit field or TX/NM state context, never a five-digit street number. Unresolved ZIP is not proof of invalid address.', 'Duplicate candidates are not confirmed duplicates; phone matches can be shared across branches.', 'Embedded locations can include the primary location and are not added to record counts.', 'Only selected public/provenance fields are read; owners, emails, tokens and billing fields are excluded.'],
  };
}

async function main() {
  let db;
  if(process.env.COVERAGE_ACCESS_TOKEN) {
    const authClient = new OAuth2Client();
    authClient.setCredentials({access_token:process.env.COVERAGE_ACCESS_TOKEN});
    db = new Firestore({projectId:'kerstenblueprint',authClient});
  } else db = getFirestore(initializeApp({credential:applicationDefault(),projectId:'kerstenblueprint'}));
  const fields = ['name','address','city','zip','postal_code','phone','website','description','category','source','source_url','google_place_id','is_published','merged_into','tier','claim_status','latitude','longitude','hours','image_url','gallery_urls','locations','updated_at'];
  const snap = await db.collection('directory_listings').select(...fields).limit(25001).get();
  if(snap.size>25000) throw new Error('Inventory exceeds read ceiling; no complete result emitted.');
  console.log(JSON.stringify({observedAt:new Date().toISOString(),project:'kerstenblueprint',database:'(default)',...summarize(snap.docs.map(d=>({id:d.id,...d.data()})))},null,2));
  await db.terminate();
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
