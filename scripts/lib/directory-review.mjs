import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const serviceArea = JSON.parse(readFileSync(new URL('../../packages/lib/src/directory/service-area.json', import.meta.url), 'utf8'));

export const normalize = v => String(v || '').normalize('NFKD').replace(/[\u0300-\u036f\uE000-\uF8FF]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const addressKey = v => normalize(v).replace(/\b(street|avenue|road|drive|boulevard|suite|texas)\b/g, s => ({street:'st',avenue:'ave',road:'rd',drive:'dr',boulevard:'blvd',suite:'ste',texas:'tx'})[s]);
export function protectedListing(row) {
  return Boolean(row.owner_id || row.stripe_subscription_id || (row.tier && row.tier !== 'basic') || (row.claim_status && row.claim_status !== 'unclaimed'));
}
export function provenanceReview(rows) {
  return rows.filter(r => r.is_published === true).flatMap(row => {
    let host = ''; try { host = new URL(row.source_url).hostname.toLowerCase(); } catch {}
    const google = /(^|\.)google\.[a-z]{2,6}(\.[a-z]{2,3})?$/.test(host) || host === 'goo.gl' || host.endsWith('.goo.gl');
    const reason = google ? 'google_source_review' : !host ? 'missing_source_review' : null;
    if (!reason) return [];
    return [{listingId:row.id,reason,protected:protectedListing(row),action:'manual_field_provenance_review',
      proposedSteps:['Preserve listing ID, owner content, claim and billing state.',
        'Establish independent permitted evidence for each imported field; never merely relabel the source.',
        'Prepare a reviewed field-level before/after diff; do not apply without approval.'],
      automaticPatch:null,delete:false,unpublish:false}];
  });
}
export function previewOutlets(outlets, existing) {
  const byName = new Map(), byAddress = new Map();
  const add = (map,key,row) => { if(key) map.set(key,[...(map.get(key)||[]),row]); };
  for(const row of existing) {
    add(byName,normalize(row.name),row);
    for(const address of [row.address,...(Array.isArray(row.locations)?row.locations.map(l=>l.address):[])]) add(byAddress,addressKey(address),row);
  }
  const seen = new Set();
  return outlets.map(raw => {
    // Explicit allowlist: taxpayer identities, mailing addresses and other source
    // fields can never flow into the candidate, even if upstream adds them.
    const name = String(raw.outlet_name||'').trim();
    const street = String(raw.outlet_address||'').trim();
    const city = String(raw.outlet_city||'').trim();
    const state = String(raw.outlet_state||'').trim();
    const zip = String(raw.outlet_zip_code||'').trim();
    const address = `${street}, ${city}, ${state} ${zip}`;
    const key = `${normalize(name)}|${addressKey(address)}`;
    const matches = (byAddress.get(addressKey(address))||[]).filter(r=>normalize(r.name)===normalize(name));
    const possible = [...(byName.get(normalize(name))||[]),...(byAddress.get(addressKey(address))||[])];
    const reasons = [];
    let decision = 'review_new';
    if(!name || !street) {decision='reject'; reasons.push('missing_name_or_street');}
    if(!serviceArea.cities.some(c => c.aliases.includes(normalize(city)) && c.states.includes(state.toUpperCase()))) {decision='reject';reasons.push('outside_or_inconsistent_target_locality');}
    if(/\b(p\.?\s*o\.?\s*box|po box|pmb)\b/i.test(street)) {decision='reject';reasons.push('mailing_only_address');}
    if(decision!=='reject' && seen.has(key)) {decision='duplicate_in_preview';reasons.push('same_name_and_location_in_batch');}
    else if(decision!=='reject' && matches.length) {decision='match_existing';reasons.push('same_name_and_normalized_location');}
    else if(decision!=='reject' && possible.length) {decision='review_possible_match';reasons.push('shared_name_or_address_not_proof_of_duplicate');}
    seen.add(key);
    const linked = [...new Map((matches.length?matches:possible).map(r=>[r.id,r])).values()];
    return {candidateId:`tx-outlet-preview:${createHash('sha256').update(key).digest('hex').slice(0,24)}`,
      name,address,city,state,zip,naics:String(raw.outlet_naics_code||''),source:'texas_comptroller',
      sourceUrl:'https://data.texas.gov/Government-and-Taxes/Active-Sales-Tax-Permit-Holders/jrea-zgmq',license:'Public Domain',
      decision,reasons,existingListingIds:linked.map(r=>r.id),protectExisting:linked.some(protectedListing),
      requiresReview:['municipal_boundary','public_business_location_or_service_area_privacy','currently_operating','category_mapping','independent_contact_details'],
      readyToPublish:false,automaticPatch:null};
  });
}
