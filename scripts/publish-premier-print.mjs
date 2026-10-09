// One-shot reviewed staff content patch. Never changes owners, tiers or current photos.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const manifest = JSON.parse(await readFile('docs/listings/premier-print-recognition.json', 'utf8'))
assert.equal(manifest.listing_id, 'premier-clinic')
if (!process.argv.includes('--publish')) {
  console.log(JSON.stringify({ listing: manifest.listing_id, recognition: manifest.print_recognition, write: false }))
} else {
  assert.ok(process.env.GOOGLE_OAUTH_ACCESS_TOKEN, 'Missing ephemeral OAuth credential')
  const headers = { Authorization: `Bearer ${process.env.GOOGLE_OAUTH_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
  const root = 'projects/kerstenblueprint/databases/(default)/documents'
  const name = `${root}/directory_listings/premier-clinic`
  const api = 'https://firestore.googleapis.com/v1/'
  const response = await fetch(`${api}${name}`, { headers })
  assert.equal(response.status, 200)
  const previous = await response.json()
  assert.equal(previous.fields.name.stringValue, 'Premier Clinic')
  // Require the deployed artwork first; never publish a broken cover reference.
  const image = await fetch('https://citybeatmag.co/print/premier-oct-nov.webp')
  assert.equal(image.status, 200)
  assert.ok(image.headers.get('content-type')?.includes('image/webp'))
  const encode = value => {
    if (value === null) return { nullValue: null }
    if (typeof value === 'string') return { stringValue: value }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, v]) => [key, encode(v)])) } }
  }
  const existing = previous.fields.print_recognition?.arrayValue?.values || []
  assert.ok(existing.length < 20, 'Maximum print appearances reached')
  assert.ok(!existing.some(v => v.mapValue?.fields?.id?.stringValue === 'premier-oct-nov-cover'), 'Cover already recorded; do not duplicate')
  const now = new Date().toISOString()
  const fields = { print_recognition: { arrayValue: { values: [...existing, ...manifest.print_recognition.map(encode)] } }, updated_at: encode(now) }
  const auditName = `${root}/directory_audit_log/premier-print-FYXN31`
  const audit = encode({ listing_id: 'premier-clinic', action: 'staff_print_recognition', actor: 'codex-user-approved', task_id: '202610090047-FYXN31', at: now, evidence: manifest.evidence }).mapValue.fields
  audit.previous_print_recognition = previous.fields.print_recognition || { nullValue: null }
  audit.previous_updated_at = previous.fields.updated_at || { nullValue: null }
  audit.print_recognition = fields.print_recognition
  const write = await fetch(`${api}${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ writes: [
    { update: { name, fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { updateTime: previous.updateTime } },
    { update: { name: auditName, fields: audit }, currentDocument: { exists: false } },
  ] }) })
  assert.equal(write.status, 200, 'Publication failed; inspect privately before retrying')
  console.log(JSON.stringify({ listing: manifest.listing_id, commitTime: (await write.json()).commitTime, audit: 'premier-print-FYXN31' }))
}
