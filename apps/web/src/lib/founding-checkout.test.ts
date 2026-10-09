import test from 'node:test'
import assert from 'node:assert/strict'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { createFoundingCheckout } from './founding-checkout'
import type { FoundingSlot } from './founding-capacity'

// Isolated test-file process: replace ALL DB operations with an in-memory
// serial transaction adapter and pass a fake Stripe client. No network/I/O.
async function fixture(initial: FoundingSlot[], run: (state: any) => Promise<void>) {
  const originalCollection = adminDb.collection
  const originalTransaction = adminDb.runTransaction
  let gate: any = { slots: structuredClone(initial) }
  let queue = Promise.resolve()
  const snapshot = () => ({ exists: true, data: () => structuredClone(gate) })
  const sessions = new Map<string, any>()
  let creates = 0
  const fakeStripe: any = { checkout: { sessions: {
    retrieve: async (id: string) => { const s = sessions.get(id); assert.ok(s); return s },
    list: () => { throw new Error('Seeded gate must not scan Stripe history') },
    create: async (params: any, options: any) => {
      const existing = [...sessions.values()].find(s => s.key === options.idempotencyKey)
      if (existing) return existing
      creates++
      const s = { id: `cs_${creates}`, key: options.idempotencyKey, url: 'https://checkout.stripe.com/test', status: 'open', payment_status: 'unpaid', expires_at: params.expires_at }
      sessions.set(s.id, s)
      return s
    },
  } } }
  ;(adminDb as any).collection = () => ({
    doc: () => ({ get: async () => snapshot() }),
    where: () => ({ query: true }),
  })
  ;(adminDb as any).runTransaction = (callback: any) => {
    const result = queue.then(() => callback({
      get: async (ref: any) => ref.query ? { docs: [] } : snapshot(),
      set: (_ref: any, value: any) => { gate = { ...gate, ...structuredClone(value) } },
    }))
    queue = result.then(() => undefined, () => undefined)
    return result
  }
  try { await run({ stripe: fakeStripe, gate: () => gate, creates: () => creates, sessions }) }
  finally { (adminDb as any).collection = originalCollection; (adminDb as any).runTransaction = originalTransaction }
}
const params: any = { mode: 'subscription', metadata: { founding: 'true', plan: 'founding', owner_id: 'test-owner' }, line_items: [{ quantity: 1 }], success_url: 'https://example.test/dashboard', cancel_url: 'https://example.test/dashboard' }

test('two concurrent businesses compete for last place: only one Stripe checkout is created', async () => {
  const full = Array.from({ length: 99 }, (_, i): FoundingSlot => ({ key: `existing${i}`, attempt: `${i}`, state: 'paid' }))
  await fixture(full, async state => {
    const results = await Promise.allSettled(['newA', 'newB'].map(key => createFoundingCheckout(state.stripe, key, params)))
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal(state.creates(), 1)
    assert.equal(state.gate().slots.length, 100)
  })
})
test('concurrent retries for one business recover one reservation and one checkout', async () => {
  await fixture([], async state => {
    const results = await Promise.all(Array.from({ length: 5 }, () => createFoundingCheckout(state.stripe, 'same-business', params)))
    assert.equal(new Set(results.map(s => s.id)).size, 1)
    assert.equal(state.creates(), 1)
    assert.equal(state.gate().slots.length, 1)
  })
})
test('an expired unpaid checkout releases its place after provider confirmation', async () => {
  await fixture([{ key: 'abandoned', attempt: 'old', state: 'open', sessionId: 'expired', expiresAt: 1 }], async state => {
    state.sessions.set('expired', { id: 'expired', status: 'expired', payment_status: 'unpaid' })
    await createFoundingCheckout(state.stripe, 'replacement', params)
    assert.deepEqual(state.gate().slots.map((s: any) => s.key), ['replacement'])
  })
})
