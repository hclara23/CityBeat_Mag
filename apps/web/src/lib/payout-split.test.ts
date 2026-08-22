import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allocateShareCents,
  bucketForService,
  buildTransferRequest,
  capShares,
  computeSplit,
  ledgerDocId,
  normalizeSplitOverrides,
  transferIdempotencyKey,
} from './payout-split'

const EDITOR = 'editor-uid-0001'
const REP = 'rep-uid-000002'

test('service → bucket mapping', () => {
  assert.equal(bucketForService('directory'), 'directory')
  assert.equal(bucketForService('ad_campaign'), 'ads')
  assert.equal(bucketForService('sponsored_post'), 'ads')
  assert.equal(bucketForService('job'), 'ads')
})

test('default split matches the SPLIT_RATES table (no overrides)', () => {
  // Rep sells directory: rep 40, editor 25, platform 35.
  const repDir = computeSplit('directory', REP, EDITOR)
  assert.deepEqual(repDir, [
    { payeeUserId: EDITOR, role: 'editor', percent: 25 },
    { payeeUserId: REP, role: 'rep', percent: 40 },
  ])
  // Editor sells ads: editor 65, no rep.
  assert.deepEqual(computeSplit('ad_campaign', EDITOR, EDITOR), [
    { payeeUserId: EDITOR, role: 'editor', percent: 65 },
  ])
  // Autonomous ads: nobody paid (platform keeps 100).
  assert.deepEqual(computeSplit('ad_campaign', null, EDITOR), [])
})

test('a rep override changes only that rep’s share on their own sales', () => {
  const overrides = { [REP]: { directory: 55 } }
  const res = computeSplit('directory', REP, EDITOR, overrides)
  assert.deepEqual(res, [
    { payeeUserId: EDITOR, role: 'editor', percent: 25 }, // editor unchanged
    { payeeUserId: REP, role: 'rep', percent: 55 }, // overridden 40 → 55
  ])
  // A different rep with no override still gets the default.
  const other = computeSplit('directory', 'rep-uid-000009', EDITOR, overrides)
  assert.equal(other.find((s) => s.role === 'rep')?.percent, 40)
})

test('an editor override applies on every sale — even where the default was 0', () => {
  const overrides = { [EDITOR]: { ads: 30 } }
  // Autonomous ads default gives the editor 0; the override creates a 30% share.
  assert.deepEqual(computeSplit('ad_campaign', null, EDITOR, overrides), [
    { payeeUserId: EDITOR, role: 'editor', percent: 30 },
  ])
})

test('an editor override of 0 removes the editor share', () => {
  const res = computeSplit('directory', REP, EDITOR, { [EDITOR]: { directory: 0 } })
  assert.equal(res.find((s) => s.role === 'editor'), undefined)
  assert.equal(res.find((s) => s.role === 'rep')?.percent, 40)
})

test('the platform never pays out more than 100% (cap protects it)', () => {
  // Editor 70 + rep 60 = 130 → capped to editor 70, rep 30 (order-preserving).
  const res = computeSplit('directory', REP, EDITOR, {
    [EDITOR]: { directory: 70 },
    [REP]: { directory: 60 },
  })
  const total = res.reduce((s, x) => s + x.percent, 0)
  assert.equal(total, 100)
  assert.equal(res.find((s) => s.role === 'editor')?.percent, 70)
  assert.equal(res.find((s) => s.role === 'rep')?.percent, 30)
})

test('capShares trims and drops shares beyond 100%', () => {
  const out = capShares([
    { payeeUserId: 'a', role: 'editor', percent: 80 },
    { payeeUserId: 'b', role: 'rep', percent: 40 },
  ])
  assert.deepEqual(out, [
    { payeeUserId: 'a', role: 'editor', percent: 80 },
    { payeeUserId: 'b', role: 'rep', percent: 20 },
  ])
})

test('transfer idempotency key is stable and null without a source payment', () => {
  assert.equal(transferIdempotencyKey('directory', EDITOR, 'cs_123'), `payout:directory:${EDITOR}:cs_123`)
  // Same inputs → same key (so a webhook retry / reconcile never double-pays).
  assert.equal(
    transferIdempotencyKey('directory', EDITOR, 'cs_123'),
    transferIdempotencyKey('directory', EDITOR, 'cs_123')
  )
  // No source payment → no dedup key (flat/manual payouts aren't deduped here).
  assert.equal(transferIdempotencyKey('directory', EDITOR, null), null)
  assert.equal(transferIdempotencyKey('directory', EDITOR, undefined), null)
})

test('buildTransferRequest includes source_transaction only when a charge id is given', () => {
  const withCharge = buildTransferRequest({
    amount: 400,
    currency: 'usd',
    destination: 'acct_rep',
    service: 'directory',
    payeeUserId: EDITOR,
    sourcePaymentId: 'cs_123',
    sourceTransaction: 'ch_abc',
  })
  assert.equal(withCharge.params.amount, 400)
  assert.equal(withCharge.params.currency, 'usd')
  assert.equal(withCharge.params.destination, 'acct_rep')
  assert.equal(withCharge.params.source_transaction, 'ch_abc')
  assert.deepEqual(withCharge.params.metadata, {
    service: 'directory',
    payee_user_id: EDITOR,
    source_payment: 'cs_123',
  })
  assert.equal(withCharge.idempotencyKey, `payout:directory:${EDITOR}:cs_123`)

  // No charge id → the field is omitted entirely (never sent as null/'').
  const noCharge = buildTransferRequest({
    amount: 250,
    currency: 'usd',
    destination: 'acct_rep',
    service: 'directory',
    payeeUserId: EDITOR,
    sourcePaymentId: 'cs_123',
  })
  assert.equal('source_transaction' in noCharge.params, false)

  // transfer_group == the stable key, so the transfer can be found again on Stripe.
  assert.equal(withCharge.params.transfer_group, `payout:directory:${EDITOR}:cs_123`)
  assert.equal(withCharge.transferGroup, `payout:directory:${EDITOR}:cs_123`)

  // No source payment → no idempotency key, no transfer_group, empty metadata src.
  const noPayment = buildTransferRequest({
    amount: 250,
    currency: 'usd',
    destination: 'acct_rep',
    service: 'directory',
    payeeUserId: EDITOR,
  })
  assert.equal(noPayment.idempotencyKey, null)
  assert.equal(noPayment.transferGroup, null)
  assert.equal('transfer_group' in noPayment.params, false)
  assert.deepEqual(noPayment.params.metadata, {
    service: 'directory',
    payee_user_id: EDITOR,
    source_payment: '',
  })
})

test('every attempt shares one stable idempotency key + transfer_group (Stripe collapses double-pay)', () => {
  const a = buildTransferRequest({
    amount: 400, currency: 'usd', destination: 'acct_rep',
    service: 'directory', payeeUserId: EDITOR, sourcePaymentId: 'cs_123',
  })
  const b = buildTransferRequest({
    amount: 400, currency: 'usd', destination: 'acct_rep',
    service: 'directory', payeeUserId: EDITOR, sourcePaymentId: 'cs_123',
  })
  // Identical key on every attempt → a concurrent webhook-retry vs reconcile race
  // can never mint two transfers for one share; Stripe dedups them.
  assert.equal(a.idempotencyKey, `payout:directory:${EDITOR}:cs_123`)
  assert.equal(a.idempotencyKey, b.idempotencyKey)
  assert.equal(a.transferGroup, a.idempotencyKey)
})

test('ledgerDocId is a stable per-share Firestore id (null without a source payment)', () => {
  assert.equal(ledgerDocId('directory', EDITOR, 'cs_123'), `payout:directory:${EDITOR}:cs_123`)
  // Same share → same doc id, so duplicate deliveries write ONE row (set/merge).
  assert.equal(ledgerDocId('directory', EDITOR, 'cs_123'), ledgerDocId('directory', EDITOR, 'cs_123'))
  // Different payee → different doc (editor vs rep never collide).
  assert.notEqual(ledgerDocId('directory', EDITOR, 'cs_123'), ledgerDocId('directory', REP, 'cs_123'))
  // No source payment (flat/manual) → no deterministic id.
  assert.equal(ledgerDocId('manual', EDITOR, null), null)
  // '/' (forbidden in Firestore ids) is sanitized out.
  assert.equal((ledgerDocId('a/b', EDITOR, 'cs_1') || '').includes('/'), false)
})

test('allocateShareCents never sums beyond the transferable base (rounding overflow)', () => {
  // 50/50 on $9.99: independent rounding would give 500+500=1000 > 999 gross.
  const shares = [
    { payeeUserId: EDITOR, role: 'editor' as const, percent: 50 },
    { payeeUserId: REP, role: 'rep' as const, percent: 50 },
  ]
  const grossAlloc = allocateShareCents(shares, 999, 999)
  assert.deepEqual(grossAlloc.map((s) => s.amountCents), [500, 499]) // sum 999, not 1000
  assert.equal(grossAlloc.reduce((s, x) => s + x.amountCents, 0) <= 999, true)
})

test('allocateShareCents reserves net-of-fees headroom (near-100% split)', () => {
  // editor 70 + rep 30 = 100% of gross, but the charge net is only 940c.
  const shares = [
    { payeeUserId: EDITOR, role: 'editor' as const, percent: 70 },
    { payeeUserId: REP, role: 'rep' as const, percent: 30 },
  ]
  const alloc = allocateShareCents(shares, 999, 940)
  assert.equal(alloc.reduce((s, x) => s + x.amountCents, 0), 940) // capped at net
  assert.equal(alloc[0].amountCents, 699) // editor paid in full first
  assert.equal(alloc[1].amountCents, 241) // rep takes the remainder (absorbs the fee gap)
})

test('allocateShareCents leaves normal splits untouched and handles empties', () => {
  // Editor 40% of $9.99 with a healthy net base → exact 40%, nothing capped.
  const alloc = allocateShareCents(
    [{ payeeUserId: EDITOR, role: 'editor', percent: 40 }],
    999,
    940
  )
  assert.equal(alloc[0].amountCents, 400)
  assert.deepEqual(allocateShareCents([], 999, 940), [])
})

test('overrides are sanitized: plausible uids, clamped percents, dropped empties', () => {
  const out = normalizeSplitOverrides({
    [EDITOR]: { label: '  Editor Jane  ', directory: 45.7, ads: 200 },
    [REP]: { directory: -5 },
    bad: { directory: 50 }, // uid too short → dropped
    'no-percent': { label: 'x' }, // no percent → dropped
    weird: 'not-an-object',
  })
  assert.equal(out[EDITOR].label, 'Editor Jane')
  assert.equal(out[EDITOR].directory, 46) // rounded + clamped
  assert.equal(out[EDITOR].ads, 100) // clamped to 100
  assert.equal(out[REP].directory, 0) // clamped to 0
  assert.equal('bad' in out, false)
  assert.equal('no-percent' in out, false)
  assert.equal('weird' in out, false)
})
