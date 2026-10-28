import assert from 'node:assert/strict'
import test from 'node:test'
import { ExecutorRegistry, type ExecutionEnvironment } from './executors'
import { TaskType } from './types'

// A ScrapeFlow dry run is a preview: it must not insert listings, advance the
// schedule, or call out. The webhook step is the one that calls out — the receiver
// has no way to tell a preview from a delivery, so posting during one hands it
// data the run was promising not to send.

function env(dryRun: boolean, inputs: Record<string, string>) {
  const outputs: Record<string, string> = {}
  const logs: string[] = []
  const environment = {
    getInput: (name: string) => inputs[name] ?? '',
    setOutput: (name: string, value: string) => { outputs[name] = value },
    getSession: () => null,
    setSession: () => undefined,
    log: {
      info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m), error: (m: string) => logs.push(m),
      write: (_l: unknown, m: string) => logs.push(m),
    },
    ctx: { workflowId: 'wf', runIndex: 0, dryRun, summary: {} as any, deadline: Date.now() + 60_000 },
  } as unknown as ExecutionEnvironment
  return { environment, outputs, logs }
}

test('DELIVER_VIA_WEBHOOK posts on a real run and does not on a dry run', async () => {
  const realFetch = globalThis.fetch
  const calls: string[] = []
  globalThis.fetch = (async (url: string) => { calls.push(String(url)); return new Response('ok', { status: 200 }) }) as typeof fetch
  try {
    const run = ExecutorRegistry[TaskType.DELIVER_VIA_WEBHOOK]
    const inputs = { 'Target URL': 'https://hooks.example.test/in', Body: '{"listings":[1]}' }

    const preview = env(true, inputs)
    assert.equal(await run(preview.environment), true, 'a preview of a delivery step succeeds, so the rest of the workflow is previewed too')
    assert.deepEqual(calls, [], 'but nothing is sent')
    assert.equal(preview.outputs.Status, 'dry-run')

    const real = env(false, inputs)
    assert.equal(await run(real.environment), true)
    assert.deepEqual(calls, ['https://hooks.example.test/in'])
    assert.equal(real.outputs.Status, '200')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a dry run still rejects a webhook that could never be delivered', async () => {
  const run = ExecutorRegistry[TaskType.DELIVER_VIA_WEBHOOK]
  assert.equal(await run(env(true, { 'Target URL': 'http://insecure.example.test', Body: '{}' }).environment), false, 'plain http is refused in a preview too')
  assert.equal(await run(env(true, { 'Target URL': '', Body: '{}' }).environment), false, 'so is a missing target')
})
