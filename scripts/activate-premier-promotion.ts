// Explicitly approved one-shot grant. Default is a dry run. No emails or ownership writes.
import assert from 'node:assert/strict'
import { premierGrant, PREMIER_PROMO } from '../apps/web/src/lib/premier-promotion'

async function main() {
const now = new Date()
const grant = { ...premierGrant(now), promotion_recipient_email: 'karmendo90@gmail.com' }
if (!process.argv.includes('--activate')) {
  console.log(JSON.stringify({ listing: 'premier-clinic', days: 30, monthlyCents: 999, locations: 3, writes: false }))
} else {
  assert.ok(process.env.GOOGLE_OAUTH_ACCESS_TOKEN, 'Missing ephemeral credential')
  const headers = { Authorization: `Bearer ${process.env.GOOGLE_OAUTH_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
  const root = 'projects/kerstenblueprint/databases/(default)/documents'
  const name = `${root}/directory_listings/premier-clinic`
  const api = 'https://firestore.googleapis.com/v1/'
  const live = await fetch('https://citybeatmag.co/api/directory/promotion')
  assert.equal(live.status, 200, 'Deploy the promotion first')
  assert.deepEqual(await live.json(), { offer: null }, 'Public request must not expose offer')
  const response = await fetch(`${api}${name}`, { headers })
  assert.equal(response.status, 200)
  const previous = await response.json()
  assert.equal(previous.fields.name.stringValue, 'Premier Clinic')
  assert.ok(!previous.fields.stripe_subscription_id?.stringValue, 'Do not overwrite a paid subscription')
  assert.ok(!previous.fields.owner_id?.stringValue, 'Review existing ownership before activating')
  assert.notEqual(previous.fields.comp_source?.stringValue, PREMIER_PROMO, 'Already activated: never reset the deadline')
  const encode = (v: any): any => v === null ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) }
  const fields = Object.fromEntries(Object.entries(grant).map(([k, v]) => [k, encode(v)]))
  const prior = Object.fromEntries(Object.keys(grant).map(k => [k, previous.fields[k] || { nullValue: null }]))
  const write = await fetch(`${api}${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ writes: [
    { update: { name, fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { updateTime: previous.updateTime } },
    { update: { name: `${root}/directory_audit_log/premier-promo-Z1VQF1`, fields: {
      listing_id: encode('premier-clinic'), action: encode('approved_30day_comp'), actor: encode('codex-user-approved'),
      task_id: encode('202610090116-Z1VQF1'), at: encode(now.toISOString()), previous: { mapValue: { fields: prior } },
    } }, currentDocument: { exists: false } },
  ] }) })
  assert.equal(write.status, 200, 'Activation failed; inspect privately before retry')
  console.log(JSON.stringify({ listing: 'premier-clinic', activated: now.toISOString(), until: grant.comp_until, audit: 'premier-promo-Z1VQF1', ownershipAssigned: false, emailsSent: false }))
}
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
