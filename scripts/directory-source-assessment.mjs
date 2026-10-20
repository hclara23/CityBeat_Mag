// Read-only public metadata and aggregate queries; no business or owner records.
const sources = [
  ['jrea-zgmq',"outlet_state='TX' AND outlet_city='EL PASO'",'outlet_zip_code','outlet_naics_code'],
  ['7358-krk7',"business_county='EL PASO'",null,'license_type'],
  ['bc5r-88dy',"county='EL PASO' AND operation_status='Y'",null,'operation_type'],
  ['7hf9-qc9f',"county='El Paso' AND primary_status='Active'",null,'license_type'],
];
async function json(url) {
  const res = await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).pathname}`);
  return res.json();
}
async function query(id,where,group) {
  const u=new URL(`https://data.texas.gov/resource/${id}.json`);
  u.searchParams.set('$where',where);
  u.searchParams.set('$select',group?`${group},count(*) AS records`:'count(*) AS records');
  if(group) {u.searchParams.set('$group',group);u.searchParams.set('$order','records DESC');}
  u.searchParams.set('$limit','1000');
  return json(u);
}
const results=[];
for(const [id,where,zip,category] of sources) {
  try {
    const m=await json(`https://data.texas.gov/api/views/${id}.json`);
    const categories=await query(id,where,category);
    results.push({id,name:m.name,metadataUrl:`https://data.texas.gov/api/views/${id}.json`,
      license:m.license||null,licenseId:m.licenseId||null,updatedAt:new Date(m.rowsUpdatedAt*1000).toISOString(),where,
      count:await query(id,where),byZip:zip?await query(id,where,zip):null,categoryGroupsReturned:categories.length,topCategories:categories.slice(0,25)});
  } catch(e) {results.push({id,error:e.message});}
}
console.log(JSON.stringify({observedAt:new Date().toISOString(),results},null,2));
