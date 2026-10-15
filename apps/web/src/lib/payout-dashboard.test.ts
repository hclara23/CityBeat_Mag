import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPayeePayoutSummary } from './payout-dashboard'

test('payee payout summary counts only real transfers and calculates month and YTD totals', () => {
  const summary = buildPayeePayoutSummary([
    { id: 'aug', status: 'paid', amount: 450, sale_at: '2026-08-21T18:00:00Z', paid_at: '2026-08-28T18:00:00Z', stripe_transfer_id: 'tr_aug' },
    { id: 'oct', status: 'paid', amount: 450, created_at: { _seconds: Date.parse('2026-10-15T18:00:00Z') / 1000 }, stripe_transfer_id: 'tr_oct' },
    { id: 'held', status: 'held', amount: 300, sale_at: '2026-10-14T18:00:00Z' },
    { id: 'last-year', status: 'paid', amount: 900, sale_at: '2025-12-20T18:00:00Z', paid_at: '2025-12-31T18:00:00Z', stripe_transfer_id: 'tr_old' },
  ], new Date('2026-10-15T20:00:00Z'))

  assert.deepEqual(summary, {
    commission_transfer_count: 3,
    ytd_earned: 1200,
    ytd_paid: 900,
    month_earned: 750,
    month_paid: 450,
  })
})

test('a paid-looking row without a Stripe transfer reference is not counted as money sent', () => {
  const summary = buildPayeePayoutSummary([
    { id: 'unsafe', status: 'paid', amount: 450, paid_at: '2026-10-15T18:00:00Z' },
  ], new Date('2026-10-15T20:00:00Z'))
  assert.equal(summary.commission_transfer_count, 0)
  assert.equal(summary.ytd_paid, 0)
})
