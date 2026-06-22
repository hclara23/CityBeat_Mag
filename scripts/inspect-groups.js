const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
initializeApp({ credential: applicationDefault(), projectId: 'kerstenblueprint' })
const db = getFirestore()
function normName(n){return String(n||'').toLowerCase().replace(/[#\d].*$/,'').replace(/\b(el paso|juarez|ciudad juarez|las cruces|tx|nm|inc|llc|co)\b/g,'').replace(/[^a-z]/g,'').trim()}
db.collection('directory_listings').get().then(snap=>{
  const groups=new Map()
  for(const doc of snap.docs){const d={id:doc.id,...doc.data()};if(d.merged_into)continue;const k=normName(d.name);if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(d)}
  const dups=[...groups.values()].filter(v=>v.length>1)
  console.log('=== GROUPS WITH DIFFERING DISPLAY NAMES (review these) ===')
  for(const m of dups){
    const names=[...new Set(m.map(x=>String(x.name||'').trim().toLowerCase()))]
    if(names.length>1){
      console.log('\n* '+m[0].name+' ('+m.length+' docs, '+names.length+' distinct names):')
      for(const x of m) console.log('    - "'+x.name+'"  @ '+(x.address||'(no addr)'))
    }
  }
  process.exit(0)
}).catch(e=>{console.error(e.message);process.exit(1)})
