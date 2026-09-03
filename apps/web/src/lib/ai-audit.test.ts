import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_OUTPUT_CHARS,
  auditContentHash,
  buildAuditRecord,
  extractAiOutput,
  redactSecrets,
  summarizeAiInput,
  verifyAuditRecord,
} from './ai-audit'

test('secrets are stripped from anything persisted', () => {
  assert.ok(!redactSecrets('key sk-ant-api03-AAAABBBBCCCCDDDD here').includes('AAAABBBB'))
  assert.ok(!redactSecrets('use sk_live_abcdef123456789').includes('abcdef123456789'))
  assert.ok(!redactSecrets('Authorization: Bearer abcdefghijklmnop.qrstuv').includes('abcdefghijklmnop'))
  assert.ok(!redactSecrets('AKIAIOSFODNN7EXAMPLE').includes('AKIAIOSFODNN7EXAMPLE'))
  assert.ok(redactSecrets('api_key: "sk-ant-9f8e7d6c5b4a3210"').includes('REDACTED'))
  // Ordinary business content must survive — this is an audit log, not a summary.
  const kept = redactSecrets('Contact Tacos El Rey at owner@tacos.com or (915) 555-1234')
  assert.ok(kept.includes('owner@tacos.com') && kept.includes('915'))
})

test('input flattens every prompt shape we actually send', () => {
  assert.equal(summarizeAiInput('plain prompt'), 'plain prompt')
  // Anthropic message array (chat, sales-agent).
  const msgs = summarizeAiInput([
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi there' },
  ])
  assert.ok(msgs.includes('user: hello') && msgs.includes('assistant: hi there'))
  // Content-block array.
  assert.ok(summarizeAiInput([{ role: 'user', content: [{ type: 'text', text: 'blocky' }] }]).includes('blocky'))
  // Object metadata form (newsroom/scrapeflow pass objects).
  assert.ok(summarizeAiInput({ business: 'Tacos', category: 'food' }).includes('Tacos'))
  // Junk is safe.
  assert.equal(summarizeAiInput(null), '')
  assert.equal(summarizeAiInput(undefined), '')
})

test('input and output are capped with an explicit truncation marker', () => {
  const long = 'x'.repeat(20000)
  const out = extractAiOutput({ content: [{ type: 'text', text: long }] })
  assert.ok(out.length < long.length)
  assert.ok(out.includes('truncated'), 'truncation must be visible, not silent')
  assert.ok(out.length <= MAX_OUTPUT_CHARS + 60)
  const capped = summarizeAiInput(long, 100)
  assert.ok(capped.includes('truncated'))
})

test('output extraction handles the real Anthropic response shape and failures', () => {
  assert.equal(extractAiOutput({ content: [{ type: 'text', text: 'the answer' }] }), 'the answer')
  // Multi-block.
  assert.equal(
    extractAiOutput({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }),
    'a\nb'
  )
  // An error object still produces an auditable string rather than throwing.
  assert.ok(extractAiOutput({ error: { type: 'overloaded_error' } }).includes('overloaded_error'))
  assert.equal(extractAiOutput(null), '')
})

test('a record hashes its own content and detects tampering', () => {
  const rec = buildAuditRecord({
    purpose: 'newsroom.rewrite',
    promptInput: 'write a brief about X',
    responseData: { model: 'claude-haiku-4-5', content: [{ type: 'text', text: 'Brief text' }], usage: { input_tokens: 10, output_tokens: 20 } },
    metadata: { article_id: 'a1' },
    now: new Date('2026-01-01T00:00:00Z'),
  })
  assert.equal(rec.model, 'claude-haiku-4-5')
  assert.equal(rec.input_tokens, 10)
  assert.equal(rec.output_tokens, 20)
  assert.deepEqual(rec.subject, { article_id: 'a1' })
  assert.equal(verifyAuditRecord(rec), true)

  // Any alteration to an audited field breaks verification.
  assert.equal(verifyAuditRecord({ ...rec, output: 'Something else entirely' }), false)
  assert.equal(verifyAuditRecord({ ...rec, model: 'gpt-4' }), false)
  assert.equal(verifyAuditRecord({ ...rec, created_at: '2020-01-01T00:00:00Z' }), false)
  assert.equal(verifyAuditRecord({ ...rec, subject: { article_id: 'a2' } }), false)
  // A record with no hash cannot be trusted.
  assert.equal(verifyAuditRecord({ ...rec, content_hash: undefined }), false)
})

test('identical content hashes identically; different content does not', () => {
  const base = {
    purpose: 'p',
    promptInput: 'in',
    responseData: { model: 'm', content: [{ type: 'text', text: 'out' }] },
    now: new Date('2026-01-01T00:00:00Z'),
  }
  assert.equal(auditContentHash(buildAuditRecord(base)), auditContentHash(buildAuditRecord(base)))
  assert.notEqual(
    auditContentHash(buildAuditRecord(base)),
    auditContentHash(buildAuditRecord({ ...base, purpose: 'other' }))
  )
})

test('a failed generation is recorded as evidence, not dropped', () => {
  const rec = buildAuditRecord({
    purpose: 'newsroom.rewrite',
    promptInput: 'prompt',
    responseData: null,
    ok: false,
    error: 'anthropic_529',
    now: new Date('2026-01-01T00:00:00Z'),
  })
  assert.equal(rec.ok, false)
  assert.equal(rec.error, 'anthropic_529')
  assert.equal(rec.model, 'unknown')
  assert.equal(verifyAuditRecord(rec), true)
})

test('latency is derived from the call start', () => {
  const start = new Date('2026-01-01T00:00:00Z')
  const rec = buildAuditRecord({
    purpose: 'p',
    promptInput: 'x',
    responseData: { content: [] },
    startTime: start,
    now: new Date('2026-01-01T00:00:02.500Z'),
  })
  assert.equal(rec.latency_ms, 2500)
})

test('the hash is independent of metadata key order (Firestore returns keys sorted)', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  const a = buildAuditRecord({
    purpose: 'p',
    promptInput: 'i',
    responseData: { model: 'm', content: [{ type: 'text', text: 'o' }] },
    metadata: { zeta: 1, alpha: 2 },
    now,
  })
  const b = buildAuditRecord({
    purpose: 'p',
    promptInput: 'i',
    responseData: { model: 'm', content: [{ type: 'text', text: 'o' }] },
    metadata: { alpha: 2, zeta: 1 },
    now,
  })
  assert.equal(a.content_hash, b.content_hash)
  // And a record read back with sorted keys still verifies.
  assert.equal(verifyAuditRecord({ ...a, subject: { alpha: 2, zeta: 1 } }), true)
})

test('undefined metadata values are stripped (Firestore would reject the write)', () => {
  const rec = buildAuditRecord({
    purpose: 'p',
    promptInput: 'i',
    responseData: { content: [] },
    metadata: { article_id: 'a1', missing: undefined, other: null },
    now: new Date('2026-01-01T00:00:00Z'),
  })
  assert.deepEqual(rec.subject, { article_id: 'a1', other: null })
  assert.ok(!Object.keys(rec.subject || {}).includes('missing'))
  // All-undefined metadata collapses to null rather than an empty map.
  const empty = buildAuditRecord({
    purpose: 'p',
    promptInput: 'i',
    responseData: { content: [] },
    metadata: { a: undefined },
    now: new Date('2026-01-01T00:00:00Z'),
  })
  assert.equal(empty.subject, null)
})

test('stored text stays under the Firestore index-entry ceiling', () => {
  // An over-cap value on an auto-indexed field makes the WRITE FAIL, silently
  // losing exactly the long generations that matter most (a full article).
  const huge = 'x'.repeat(100000)
  const rec = buildAuditRecord({
    purpose: 'p',
    promptInput: huge,
    responseData: { content: [{ type: 'text', text: huge }] },
    now: new Date('2026-01-01T00:00:00Z'),
  })
  assert.ok(Buffer.byteLength(rec.output, 'utf8') < 7000, `output=${rec.output.length}`)
  assert.ok(Buffer.byteLength(rec.input, 'utf8') < 7000, `input=${rec.input.length}`)
})
