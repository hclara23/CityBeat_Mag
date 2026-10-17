// Reviewed, one-off Varsity Roofing media refresh.
// Dry-run verifies every official website asset. Publication requires --publish
// and an ephemeral GOOGLE_OAUTH_ACCESS_TOKEN.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const listingId = 'WZ084cO6lk7LIpR4r0Jn'
const taskId = '202610170134-BYFRQF'
const sourceSite = 'https://varsityroofing.com/'
const logo = 'https://img1.wsimg.com/isteam/ip/d305dd04-09f7-4a59-b3cd-fc9c51cccb9e/Varsity-p-trans.png/:/rs=w:618,h:285,cg:true,m/cr=w:618,h:285/qt=q:95'
const cover = 'https://img1.wsimg.com/isteam/getty/1756776054/:/rs=w:1920,m'
const gallery = [
  logo,
  'https://img1.wsimg.com/isteam/stock/DjDmbPd/:/cr=t:0%25,l:5.67%25,w:88.67%25,h:100%25/rs=w:1200,h:902,cg:true',
  'https://img1.wsimg.com/isteam/stock/D1W5kb4/:/cr=t:0%25,l:4.59%25,w:90.81%25,h:100%25/rs=w:1200,h:902,cg:true',
  'https://img1.wsimg.com/isteam/stock/6yW0n7a/:/cr=t:0%25,l:5.67%25,w:88.67%25,h:100%25/rs=w:1200,h:902,cg:true',
  'https://img1.wsimg.com/isteam/stock/DxxxWam/:/cr=t:0%25,l:5.67%25,w:88.67%25,h:100%25/rs=w:1164,h:875,cg:true',
  'https://img1.wsimg.com/isteam/stock/QBB9lkx/:/cr=t:0%25,l:5.67%25,w:88.67%25,h:100%25/rs=w:1164,h:875,cg:true',
]

for (const url of [cover, ...gallery]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  assert.equal(response.status, 200, `Official website asset unavailable: ${url}`)
  assert.match(response.headers.get('content-type') || '', /^image\//, `Not an image: ${url}`)
  assert.ok((await response.arrayBuffer()).byteLength > 10_000, `Image is unexpectedly small: ${url}`)
}

if (!process.argv.includes('--publish')) {
  console.log(JSON.stringify({ ok: true, sourceSite, listingId, cover, galleryCount: gallery.length }))
  process.exit(0)
}

const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN
assert.ok(token, 'Missing ephemeral GOOGLE_OAUTH_ACCESS_TOKEN')
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const root = 'projects/kerstenblueprint/databases/(default)/documents'
const name = `${root}/directory_listings/${listingId}`
const api = 'https://firestore.googleapis.com/v1/'
const currentResponse = await fetch(`${api}${name}`, { headers })
assert.equal(currentResponse.status, 200, 'Could not read the Varsity Roofing listing')
const current = await currentResponse.json()
assert.equal(current.fields?.name?.stringValue, 'Varsity Roofing')
assert.equal(current.fields?.phone?.stringValue, '1952611098')
assert.equal(current.fields?.website?.stringValue, sourceSite)

const encode = (value) => {
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } }
}
const now = new Date().toISOString()
const output = path.resolve('.tmp/varsity-listing')
await mkdir(output, { recursive: true })
await writeFile(path.join(output, 'before-publication.json'), JSON.stringify(current, null, 2), { flag: 'wx' })

const patch = { image_url: cover, gallery_urls: gallery, updated_at: now }
const fields = encode(patch).mapValue.fields
const previous = {
  image_url: current.fields?.image_url || { nullValue: null },
  gallery_urls: current.fields?.gallery_urls || { arrayValue: {} },
  updated_at: current.fields?.updated_at || { nullValue: null },
}
const auditId = `varsity-media-${Date.now()}`
const audit = encode({
  listing_id: listingId,
  task_id: taskId,
  action: 'staff_media_refresh',
  actor: 'codex-user-approved',
  source_site: sourceSite,
  changed_fields: Object.keys(patch),
  at: now,
}).mapValue.fields
audit.previous_fields = { mapValue: { fields: previous } }

const commit = await fetch(`${api}${root}:commit`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ writes: [
    {
      update: { name, fields },
      updateMask: { fieldPaths: Object.keys(fields) },
      currentDocument: { updateTime: current.updateTime },
    },
    {
      update: { name: `${root}/directory_audit_log/${auditId}`, fields: audit },
      currentDocument: { exists: false },
    },
  ] }),
})
assert.equal(commit.status, 200, `Publication failed (${commit.status})`)
const result = await commit.json()
console.log(JSON.stringify({ ok: true, listingId, auditId, commitTime: result.commitTime }))
