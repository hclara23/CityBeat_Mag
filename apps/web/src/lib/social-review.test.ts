import { test } from 'node:test'
import assert from 'node:assert/strict'
import { independentlyReviewCaption } from './social-review'

test('approved caption is checked by independent reviewer before release', async () => {
  const order: string[] = []
  const result = await independentlyReviewCaption({
    write: async () => { order.push('writer'); return { caption: 'A community gathering.' } },
    review: async caption => { order.push('reviewer'); assert.equal(caption, 'A community gathering.'); return { approved: true, reason: 'Image supports caption' } },
    record: async () => { order.push('record'); return true },
  })
  assert.deepEqual(order, ['writer', 'reviewer', 'record'])
  assert.equal(result.verdict.approved, true)
})
test('rejection gets exactly one rewrite and a fresh review, then stops', async () => {
  let writes = 0, reviews = 0
  const result = await independentlyReviewCaption({
    write: async feedback => { if (writes) assert.equal(feedback, 'Date unsupported'); writes++; return { caption: 'Candidate' } },
    review: async () => { reviews++; return { approved: false, reason: 'Date unsupported' } },
    record: async () => true,
  })
  assert.equal(writes, 2); assert.equal(reviews, 2)
  assert.equal(result.verdict.approved, false)
})
test('revision can pass only after reviewer accepts new caption', async () => {
  let reviews = 0
  const result = await independentlyReviewCaption({ write: async () => ({ caption: 'A verified description.' }),
    review: async () => ({ approved: ++reviews === 2, reason: 'Review result' }), record: async () => true })
  assert.equal(reviews, 2); assert.equal(result.verdict.approved, true)
})
test('malformed review and provider failure never become approval', async () => {
  for (const review of [async () => ({ approved: 'true', reason: 'ok' }), async () => { throw new Error('provider unavailable') }]) {
    await assert.rejects(independentlyReviewCaption({ write: async () => ({ caption: 'Caption' }), review, record: async () => true }))
  }
})
test('cancelled state stops further calls and prevents release', async () => {
  let calls = 0
  const result = await independentlyReviewCaption({ write: async () => { calls++; return { caption: 'Caption' } },
    review: async () => ({ approved: false, reason: 'No' }), record: async () => false })
  assert.equal(calls, 1); assert.equal(result.cancelled, true)
})
