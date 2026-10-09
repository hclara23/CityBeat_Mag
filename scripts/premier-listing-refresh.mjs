// One-off, reviewed content refresh. Default mode only optimizes local photos.
// Publication requires --publish and an ephemeral GOOGLE_OAUTH_ACCESS_TOKEN.
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import sharp from 'sharp'

const manifest = JSON.parse(await readFile('docs/listings/premier-clinic-2026-10.json', 'utf8'))
const output = path.resolve('.tmp/premier-listing')
const docRoot = 'projects/kerstenblueprint/databases/(default)/documents'
const name = `${docRoot}/directory_listings/premier-clinic`
assert.equal(manifest.listing_id, 'premier-clinic')
assert.equal(manifest.patch.locations.length, 3)
assert.equal(manifest.assets.length, 5)
assert.equal(manifest.patch.website, 'https://premierclinic.us/')
assert.ok(!/nayeli|quest/i.test(JSON.stringify(manifest.patch)))
for (const field of ['tier', 'owner_id', 'claim_status', 'is_sponsored', 'stripe_subscription_id']) {
  assert.ok(!(field in manifest.patch), `Must preserve ${field}`)
}
await mkdir(output, { recursive: true })

if (!process.argv.includes('--publish')) {
  let before = 0
  let after = 0
  for (const asset of manifest.assets) {
    const source = path.join(manifest.asset_root, asset.source)
    const destination = path.join(output, asset.filename)
    const cover = asset.filename === 'patient-visit.webp'
    const bytes = await sharp(source).rotate()
      .resize({ width: cover ? 1400 : 1000, height: cover ? 1400 : 1000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 76, effort: 6 }).toBuffer()
    const original = await stat(source)
    // Never replace a smaller original WebP with a larger re-encoding.
    const selected = bytes.length < original.size ? bytes : await readFile(source)
    await writeFile(destination, selected)
    const meta = await sharp(selected).metadata()
    assert.equal(meta.format, 'webp')
    before += original.size
    after += selected.length
    console.log(JSON.stringify({ file: asset.filename, before: original.size, after: selected.length, width: meta.width, height: meta.height }))
  }
  console.log(JSON.stringify({ totalBefore: before, totalAfter: after, savedPercent: Math.round((1 - after / before) * 100) }))
} else {
  const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN
  assert.ok(token, 'Missing ephemeral OAuth token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const api = 'https://firestore.googleapis.com/v1/'
  const response = await fetch(`${api}${name}`, { headers })
  assert.equal(response.status, 200, 'Could not read target listing')
  const previous = await response.json()
  assert.equal(previous.updateTime, manifest.expected_update_time, 'Listing changed; review before retrying')
  assert.equal(previous.fields.tier.stringValue, 'premium')
  assert.equal(previous.fields.name.stringValue, 'Premier Clinic')
  for (const url of [manifest.patch.image_url, ...manifest.patch.gallery_urls]) {
    const image = await fetch(url)
    assert.equal(image.status, 200, `Photo unavailable: ${url}`)
    assert.ok(image.headers.get('content-type')?.includes('image/webp'))
    const meta = await sharp(Buffer.from(await image.arrayBuffer())).metadata()
    assert.equal(meta.format, 'webp')
  }
  const encode = (value) => {
    if (value === null) return { nullValue: null }
    if (typeof value === 'string') return { stringValue: value }
    if (typeof value === 'boolean') return { booleanValue: value }
    if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, val]) => [key, encode(val)])) } }
  }
  const patch = { ...manifest.patch, updated_at: new Date().toISOString() }
  const fields = encode(patch).mapValue.fields
  const auditName = `${docRoot}/directory_audit_log/premier-refresh-20261009-R64WEQ`
  const priorFields = Object.fromEntries(Object.keys(fields).filter(key => key in previous.fields).map(key => [key, previous.fields[key]]))
  const missingFields = Object.keys(fields).filter(key => !(key in previous.fields))
  // Retain a local recovery copy, plus an atomic server-side audit snapshot.
  await writeFile(path.join(output, 'before-publication.json'), JSON.stringify(previous, null, 2), { flag: 'wx' })
  const audit = encode({ listing_id: 'premier-clinic', action: 'staff_content_refresh', actor: 'codex-user-approved', task_id: '202610090023-R64WEQ', at: patch.updated_at, changed_fields: Object.keys(fields), previously_missing_fields: missingFields }).mapValue.fields
  audit.previous_fields = { mapValue: { fields: priorFields } }
  const result = await fetch(`${api}${docRoot}:commit`, {
    method: 'POST', headers, body: JSON.stringify({ writes: [
      { update: { name, fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { updateTime: previous.updateTime } },
      { update: { name: auditName, fields: audit }, currentDocument: { exists: false } },
    ] }),
  })
  assert.equal(result.status, 200, `Publication failed (${result.status}); inspect server response privately before retrying`)
  const committed = await result.json()
  console.log(JSON.stringify({ listing: 'premier-clinic', commitTime: committed.commitTime, audit: auditName.split('/').at(-1), url: 'https://citybeatmag.co/en/directory/premier-clinic' }))
}
