// Clone and release the existing Hosting version without changing files or routing.
// A Cloud Run traffic switch alone does not invalidate Firebase's cached HTML.
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const account = process.argv[2]
const expectedVersion = process.argv[3]
const apply = process.argv.includes('--apply')
assert.match(account || '', /^[a-zA-Z0-9@._+-]+$/, 'Supply an authorized Google account')
const token = execFileSync('gcloud.cmd', ['auth', 'print-access-token', `--account=${account}`], {
  encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
}).trim()
const base = 'https://firebasehosting.googleapis.com/v1beta1'
const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': 'kerstenblueprint', 'Content-Type': 'application/json' }
const list = await fetch(`${base}/sites/kerstenblueprint/releases?pageSize=1`, { headers, signal: AbortSignal.timeout(30000) })
assert.equal(list.status, 200, 'Could not inspect current Hosting release')
const current = (await list.json()).releases?.[0]
assert.equal(current?.type, 'DEPLOY')
const version = current.version?.name
assert.match(version || '', /^sites\/kerstenblueprint\/versions\/[a-zA-Z0-9_-]+$/)
assert.ok(current.version.config?.rewrites?.some(rule => rule.glob === '**' && rule.run?.serviceId === 'citybeat-web' && rule.run?.region === 'us-central1'), 'Unexpected Hosting route')
console.log(JSON.stringify({ currentRelease: current.name, version, fileCount: current.version.fileCount, apply }))
if (apply) {
  assert.equal(version, expectedVersion, 'Hosting changed since inspection; refusing to overwrite another release')
  const clone = await fetch(`${base}/sites/kerstenblueprint/versions:clone`, {
    method: 'POST', headers, body: JSON.stringify({ sourceVersion: version, finalize: true }), signal: AbortSignal.timeout(30000),
  })
  assert.equal(clone.status, 200, 'Hosting clone failed')
  let operation = await clone.json()
  for (let attempt = 0; !operation.done && attempt < 30; attempt++) {
    assert.match(operation.name || '', /^projects\/854761587817\/operations\/[\w-]+$/)
    await new Promise(resolve => setTimeout(resolve, 1000))
    const poll = await fetch(`${base}/${operation.name}`, { headers, signal: AbortSignal.timeout(30000) })
    assert.equal(poll.status, 200)
    operation = await poll.json()
  }
  assert.ok(operation.done && !operation.error, 'Hosting clone did not complete successfully')
  const cloned = operation.response
  assert.match(cloned?.name || '', /^sites\/kerstenblueprint\/versions\/[a-zA-Z0-9_-]+$/)
  assert.deepEqual(cloned.config, current.version.config, 'Cloned routing differs')
  assert.equal(cloned.fileCount, current.version.fileCount, 'Cloned file count differs')
  assert.equal(cloned.status, 'FINALIZED')
  const latest = await fetch(`${base}/sites/kerstenblueprint/releases?pageSize=1`, { headers, signal: AbortSignal.timeout(30000) })
  assert.equal(latest.status, 200)
  assert.equal((await latest.json()).releases?.[0]?.version?.name, version, 'Concurrent Hosting release detected')
  const response = await fetch(`${base}/sites/kerstenblueprint/releases?versionName=${encodeURIComponent(cloned.name)}`, {
    method: 'POST', headers, body: JSON.stringify({ message: 'Refresh cached HTML after tested Cloud Run audit release; preserve existing files and routing.' }), signal: AbortSignal.timeout(30000),
  })
  const released = await response.json()
  assert.equal(response.status, 200, `Hosting refresh failed: ${released.error?.message || response.status}`)
  assert.equal(released.version?.name, cloned.name)
  console.log(JSON.stringify({ release: released.name, version: released.version.name, releaseTime: released.releaseTime }))
}
