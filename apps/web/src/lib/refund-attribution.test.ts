import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFullyRefunded, refundPatchForPurchaseRows } from './refund-attribution'

// These pin what a refund is allowed to write onto an ad_purchases row. Finance
// (purchaseCollectedCents) subtracts amount_refunded from collected revenue, so
// every case below is an accounting figure, not a status flag.

const patchFor = (
  result: Array<{ id: string; patch: { amount_refunded?: number } }>,
  id: string
) => result.find((entry) => entry.id === id)?.patch

test('a full refund charges each backing row its own price, never the cart total', () => {
  // A three-item cart: one charge, three rows, each refunded what it cost. If the
  // charge total were written onto each of them, finance would subtract $45 from
  // a $45 sale three times over.
  const result = refundPatchForPurchaseRows({
    fullyRefunded: true,
    chargeAmountRefunded: 4500,
    rows: [
      { id: 'a', amount_total: 1000 },
      { id: 'b', amount_total: 1500 },
      { id: 'c', amount_total: 2000 },
    ],
  })
  assert.equal(result.length, 3)
  assert.deepEqual(patchFor(result, 'a'), { amount_refunded: 1000 })
  assert.deepEqual(patchFor(result, 'b'), { amount_refunded: 1500 })
  assert.deepEqual(patchFor(result, 'c'), { amount_refunded: 2000 })
})

test('a partial refund with one backing row records the charge figure on that row', () => {
  const result = refundPatchForPurchaseRows({
    fullyRefunded: false,
    chargeAmountRefunded: 750,
    rows: [{ id: 'only', amount_total: 2000 }],
  })
  assert.deepEqual(result, [{ id: 'only', patch: { amount_refunded: 750 } }])
})

test('a partial refund across several rows records nothing rather than inventing a split', () => {
  // Stripe says $7.50 came back off a $40 charge but never which items it came
  // off. Writing it on either row, or on both, is a number we made up.
  const result = refundPatchForPurchaseRows({
    fullyRefunded: false,
    chargeAmountRefunded: 750,
    rows: [
      { id: 'a', amount_total: 2000 },
      { id: 'b', amount_total: 2000 },
    ],
  })
  assert.equal(result.length, 2)
  assert.deepEqual(patchFor(result, 'a'), {})
  assert.deepEqual(patchFor(result, 'b'), {})
  for (const entry of result) {
    assert.equal('amount_refunded' in entry.patch, false)
  }
})

test('a full refund never writes amount_refunded: 0 onto a row with no usable price', () => {
  // Zero is not "we do not know" — it tells finance this row was fully refunded
  // AND that nothing came back, so the sale keeps counting gross forever. Omit
  // the field instead and let the refund alert bring a human to it.
  const result = refundPatchForPurchaseRows({
    fullyRefunded: true,
    chargeAmountRefunded: 3000,
    rows: [
      { id: 'priced', amount_total: 1000 },
      { id: 'missing' },
      { id: 'null', amount_total: null },
      { id: 'garbage', amount_total: Number('nope') },
    ],
  })
  assert.deepEqual(patchFor(result, 'priced'), { amount_refunded: 1000 })
  for (const id of ['missing', 'null', 'garbage']) {
    assert.deepEqual(patchFor(result, id), {}, id + ' must be omitted, not zeroed')
    assert.equal('amount_refunded' in (patchFor(result, id) as object), false)
  }
})

test('a negative or non-numeric refund figure never reaches a money field', () => {
  // Nothing in Stripe should send these, but amount_refunded is SUBTRACTED from
  // revenue: a negative would increase reported collections off a refund.
  for (const bogus of [-500, Number.NaN, Number('x')]) {
    const result = refundPatchForPurchaseRows({
      fullyRefunded: false,
      chargeAmountRefunded: bogus,
      rows: [{ id: 'only', amount_total: 2000 }],
    })
    assert.deepEqual(result, [{ id: 'only', patch: { amount_refunded: 0 } }])
  }
  // A full refund cannot borrow a negative charge figure for a priceless row.
  const full = refundPatchForPurchaseRows({
    fullyRefunded: true,
    chargeAmountRefunded: -500,
    rows: [{ id: 'only' }],
  })
  assert.deepEqual(full, [{ id: 'only', patch: {} }])
})

test('no backing rows yields no writes at all', () => {
  assert.deepEqual(
    refundPatchForPurchaseRows({ fullyRefunded: true, chargeAmountRefunded: 2000, rows: [] }),
    []
  )
  assert.deepEqual(
    refundPatchForPurchaseRows({ fullyRefunded: false, chargeAmountRefunded: 500, rows: [] }),
    []
  )
})

test('one row reached through both webhook lookups is still ONE row, not a cart', () => {
  // The webhook finds backing rows by payment_intent/session AND by sales_order,
  // and for a single rep-sold item both return the same document. Counting it
  // twice would make an attributable refund look unattributable and stop
  // recording a figure we know exactly.
  const result = refundPatchForPurchaseRows({
    fullyRefunded: false,
    chargeAmountRefunded: 750,
    rows: [
      { id: 'same', amount_total: 2000 },
      { id: 'same', amount_total: 2000 },
    ],
  })
  assert.deepEqual(result, [{ id: 'same', patch: { amount_refunded: 750 } }])
})

test('a single-item self-serve refund is attributed exactly as it was before this module existed', () => {
  // The common path, and the one that must not move. Before the union was
  // gathered, the webhook wrote this expression onto the single row it found by
  // payment_intent / session id.
  const legacy = (fullyRefunded: boolean, amountTotal: unknown, chargeAmountRefunded: number) =>
    fullyRefunded
      ? Number(amountTotal) || Number(chargeAmountRefunded || 0)
      : Number(chargeAmountRefunded || 0)

  const cases: Array<{ fully: boolean; amountTotal: unknown; refunded: number }> = [
    { fully: true, amountTotal: 2000, refunded: 2000 },
    { fully: true, amountTotal: 4999, refunded: 4999 },
    { fully: true, amountTotal: undefined, refunded: 2000 }, // no price stored on the row
    { fully: false, amountTotal: 2000, refunded: 750 },
    { fully: false, amountTotal: 2000, refunded: 0 },
    { fully: false, amountTotal: undefined, refunded: 750 },
  ]
  for (const { fully, amountTotal, refunded } of cases) {
    const [entry] = refundPatchForPurchaseRows({
      fullyRefunded: fully,
      chargeAmountRefunded: refunded,
      rows: [{ id: 'self-serve', amount_total: amountTotal as number | null | undefined }],
    })
    assert.equal(
      entry.patch.amount_refunded,
      legacy(fully, amountTotal, refunded),
      'single-row ' + (fully ? 'full' : 'partial') + ' refund changed for amount_total=' + String(amountTotal)
    )
  }
})

test('fully refunded still means Stripe said so OR the cumulative refunds cover the charge', () => {
  // Moved verbatim out of the webhook: amount_refunded is CUMULATIVE, so this is
  // a comparison against the charge total, not a per-refund fact.
  assert.equal(isFullyRefunded({ amount: 2000, amount_refunded: 2000 }), true)
  assert.equal(isFullyRefunded({ amount: 2000, amount_refunded: 500 }), false)
  assert.equal(isFullyRefunded({ amount: 2000, amount_refunded: 1999 }), false)
  // Stripe's own flag wins even when the object we were handed carries no
  // amounts — the dispute path synthesises exactly such a charge.
  assert.equal(isFullyRefunded({ refunded: true }), true)
  assert.equal(isFullyRefunded({ amount: 2000, amount_refunded: 0, refunded: true }), true)
  // A charge with nothing refunded is not "fully refunded".
  assert.equal(isFullyRefunded({ amount: 2000, amount_refunded: 0 }), false)
  assert.equal(isFullyRefunded({ amount: 2000 }), false)
})
