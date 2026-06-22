const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
initializeApp({ credential: applicationDefault(), projectId: 'kerstenblueprint' })
const db = getFirestore()
async function main(){
  const all = await db.collection('directory_listings').get()
  let pub=0, multi=0, merged=0
  for(const d of all.docs){const x=d.data(); if(x.is_published)pub++; if(x.is_multi_location)multi++; if(x.merged_into)merged++}
  console.log('total:',all.size,'| published:',pub,'| multi_location:',multi,'| merged_away:',merged)
  const mc = await db.collection('directory_listings').doc('0827fb8d-16cf-4a14-857d-4a42bd7623c6').get()
  const m = mc.data()
  console.log('\nMcDonald\'s canonical: published=',m.is_published,' location_count=',m.location_count,' locations.len=',(m.locations||[]).length)
  console.log('  sample locations:', (m.locations||[]).slice(0,3).map(l=>l.address))
  const banners = await db.collection('ad_banners').get()
  console.log('\nbanners:', banners.docs.map(d=>d.data().sponsor_name+' ['+d.data().placement+', active='+d.data().is_active+']'))
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})
