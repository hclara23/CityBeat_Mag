import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPayoutStatement,
  canReserveStatementDelivery,
  payoutCycleStatementPeriod,
  payoutStatementHtml,
  previousCalendarMonth,
  statementDeliveryId,
  yearToDateStatementPeriod,
} from './payout-statements'

test('previous calendar month handles year boundaries in UTC', () => {
  assert.deepEqual(previousCalendarMonth(new Date('2027-01-15T12:00:00Z')), {
    key: '2026-12', start: '2026-12-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z',
  })
})

test('cycle statement periods use El Paso half-month boundaries and stable delivery keys', () => {
  const firstHalf = payoutCycleStatementPeriod(new Date('2026-10-15T15:00:00Z'))
  assert.equal(firstHalf.key, 'cycle-2026-10-15')
  assert.equal(firstHalf.start, '2026-10-01T06:00:00.000Z')
  assert.equal(firstHalf.end, '2026-10-15T15:00:00.001Z')

  const monthEnd = payoutCycleStatementPeriod(new Date('2026-11-30T16:00:00Z'))
  assert.equal(monthEnd.key, 'cycle-2026-11-30')
  assert.equal(monthEnd.start, '2026-11-16T07:00:00.000Z')
  assert.equal(monthEnd.end, '2026-11-30T16:00:00.001Z')
})

test('year-to-date statement starts at local New Year and includes the current run', () => {
  const period = yearToDateStatementPeriod(new Date('2026-10-15T20:00:00Z'))
  assert.deepEqual(period, {
    key: 'ytd-2026-10-15',
    label: '2026 year-to-date',
    start: '2026-01-01T07:00:00.000Z',
    end: '2026-10-15T20:00:00.001Z',
  })
})

test('statement isolates payees, calculates refunds, statuses, outstanding and YTD totals', () => {
  const statement = buildPayoutStatement({
    payeeUserId: 'editor',
    period: { key: '2026-09', start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' },
    now: new Date('2026-10-02T00:00:00Z'),
    payments: [{ id: 'in_1', amount: 999, gross_amount: 999 }],
    transfers: [
      { id: 'a', payee_user_id: 'editor', source_payment: 'in_1', amount: 400, original_amount: 450, percent: 45, role: 'editor', service: 'directory', status: 'held', sale_at: '2026-09-10T00:00:00Z', eligible_at: '2026-09-17T00:00:00Z' },
      { id: 'b', payee_user_id: 'editor', amount: 200, percent: 20, status: 'paid', sale_at: '2026-08-20T00:00:00Z', paid_at: '2026-09-02T00:00:00Z', stripe_transfer_id: 'tr_safe' },
      { id: 'c', payee_user_id: 'other', amount: 99999, status: 'held', sale_at: '2026-09-10T00:00:00Z' },
    ],
  })
  assert.equal(statement.lines.length, 2)
  assert.equal(statement.totals.gross_source_amount, 999)
  assert.equal(statement.totals.earned, 450)
  assert.equal(statement.totals.adjustments, -50)
  assert.equal(statement.totals.paid, 200)
  assert.equal(statement.totals.due, 400)
  assert.equal(statement.totals.outstanding, 400)
  assert.equal(statement.totals.ytd_earned, 650)
  assert.equal(statement.totals.ytd_adjustments, -50)
  assert.equal(statement.totals.ytd_paid, 200)
})

test('manual catch-up transfers appear in the month they were issued', () => {
  const statement = buildPayoutStatement({
    payeeUserId: 'editor',
    period: { key: '2026-10', start: '2026-10-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' },
    transfers: [
      {
        id: 'manual:catch-up',
        payee_user_id: 'editor',
        amount: 450,
        service: 'manual',
        status: 'paid',
        created_at: { _seconds: Date.parse('2026-10-15T20:00:00Z') / 1000 },
        stripe_transfer_id: 'tr_catch_up',
      },
    ],
  })

  assert.equal(statement.lines.length, 1)
  assert.equal(statement.lines[0]?.earned_at, '2026-10-15T20:00:00.000Z')
  assert.equal(statement.lines[0]?.stripe_transfer_id, 'tr_catch_up')
  assert.equal(statement.totals.earned, 450)
  assert.equal(statement.totals.paid, 450)
  assert.equal(statement.totals.ytd_paid, 450)
})

test('delivery keys are stable and only failed deliveries can retry', () => {
  assert.equal(statementDeliveryId('user@example.com', '2026-09'), '2026-09_user_example_com')
  assert.equal(canReserveStatementDelivery(null), true)
  assert.equal(canReserveStatementDelivery('failed'), true)
  assert.equal(canReserveStatementDelivery('sending'), false)
  assert.equal(canReserveStatementDelivery('sent'), false)
})

test('email escapes ledger content and never invents bank details', () => {
  const statement = buildPayoutStatement({
    payeeUserId: 'editor',
    period: { key: '2026-09', start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' },
    transfers: [{ id: 'x', payee_user_id: 'editor', amount: 450, service: '<script>', status: 'paid', sale_at: '2026-09-01T00:00:00Z' }],
  })
  const html = payoutStatementHtml(statement)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /Not recorded by CityBeat/)
  assert.doesNotMatch(html, /bank account|routing number|ending in/i)
})
