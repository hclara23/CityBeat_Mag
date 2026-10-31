// Integration check against an explicitly local Firestore emulator only.
// Run from apps/web: node --import tsx ../../scripts/directory-quality-local.ts
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088') throw new Error('Requires the local quality emulator on 127.0.0.1:8088; refusing any other database.')
  const { adminDb } = await import('../packages/lib/src/firebase/admin')
  const { runDirectoryIngest } = await import('../packages/lib/src/directory/crawlee-ingest')
  const { deliverToDirectory } = await import('../apps/web/src/lib/scrapeflow/directory-sink')
  const collection = adminDb.collection('directory_listings')
  const stamp = Date.now()
  const ids = Array.from({ length: 6 }, (_, index) => stamp + index)
  const existingId = `osm:node:${ids[5]}`
  const paid = { name: 'Synthetic Paid Shop', tier: 'premium', owner_id: 'synthetic-owner', claim_status: 'approved', stripe_subscription_id: 'synthetic-sub', is_published: true }
  await collection.doc(existingId).create(paid)
  const cities = ['El Paso', 'Horizon City', 'Sierra Blanca', 'Odessa', null, 'El Paso']
  const elements = ids.map((id, index) => ({ type: 'node', id, lat: 31.8, lon: -106.4, tags: {
    name: index === 5 ? 'Synthetic Paid Shop' : `Synthetic Import ${stamp}-${index}`,
    'addr:housenumber': '123', 'addr:street': 'Example St',
    ...(cities[index] ? { 'addr:city': cities[index], 'addr:state': 'TX' } : {}),
  } }))
  const server = createServer((_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ elements })) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address() as { port: number }
    const options = { overpassUrl: `http://127.0.0.1:${address.port}`, categories: ['Auto Repair'], write: true, limit: 20 }
    const first = await runDirectoryIngest(options)
    assert.equal(first.inserted, 4)
    assert.equal((await collection.doc(`osm:node:${ids[3]}`).get()).exists, false, 'Outside city must never be stored')
    for (const index of [0, 1, 2, 4]) {
      const row = (await collection.doc(`osm:node:${ids[index]}`).get()).data()!
      assert.equal(row.is_published, false)
      assert.equal(row.publication_hold, 'import_quality_review')
      assert.equal(row.last_verified_at, null)
      assert.match(row.source_url, /^https:\/\/www.openstreetmap.org\/node\//)
    }
    assert.equal((await runDirectoryIngest(options)).inserted, 0, 'Replays do not overwrite records')
    assert.deepEqual((await collection.doc(existingId).get()).data(), paid)
    const opts = { defaultCategory: 'Auto Repair', regionFilter: false, publish: true, consolidate: true, dryRun: false, sourceUrl: 'https://example.invalid/source', workflowId: null }
    const result = await deliverToDirectory([
      { name: `Synthetic SF ${stamp}`, address: '123 Example St', city: 'El Paso', state: 'TX' },
      { name: `Synthetic SF ${stamp}`, address: '456 Other St', city: 'El Paso', state: 'TX' },
      { name: `Synthetic Outside ${stamp}`, address: '123 Example St', city: 'Odessa', state: 'TX' },
    ], opts)
    assert.equal(result.inserted, 2, 'Branches remain separate; outside rows cannot bypass the region flag')
    for (const id of result.inserted_ids) {
      const row = (await collection.doc(id).get()).data()!
      assert.equal(row.is_published, false, 'The legacy publish option cannot bypass review')
      assert.equal(row.merged_into, undefined, 'The legacy consolidation option cannot merge drafts')
    }
    assert.equal((await deliverToDirectory([{ name: `Synthetic SF ${stamp}`, address: '123 Example St', city: 'El Paso', state: 'TX' }], opts)).inserted, 0)
    await collection.doc('quality-public-example').set({ name: 'Synthetic Local Test Shop', category: 'Auto Repair', address: '123 Example St, El Paso, TX 79901', tier: 'basic', is_published: true, rating: null, claim_status: 'unclaimed' })
    console.log('PASS: OSM + ScrapeFlow imports, geographic rejection, review holds, replay safety, paid-owner preservation, separate branches. All writes were local emulator fixtures.')
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await adminDb.terminate()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
