export type StatementTransfer = {
  id: string
  payee_user_id?: string | null
  source_payment?: string | null
  service?: string | null
  role?: string | null
  percent?: number | null
  amount?: number | null
  original_amount?: number | null
  currency?: string | null
  status?: string | null
  sale_at?: unknown
  accrued_at?: unknown
  created_at?: unknown
  eligible_at?: unknown
  paid_at?: unknown
  clawback_at?: unknown
  clawback_owed_amount?: number | null
  stripe_transfer_id?: string | null
  stripe_payout_id?: string | null
  stripe_payout_status?: string | null
  stripe_payout_at?: unknown
}

export type StatementPayment = {
  id: string
  amount?: number | null
  gross_amount?: number | null
  amount_refunded?: number | null
  currency?: string | null
}

export type StatementLine = {
  ledger_id: string
  source_payment: string | null
  gross_source_amount: number | null
  commission_rate: number
  role: string
  service: string
  earned: number
  adjustment: number
  earned_at: string | null
  adjustment_at: string | null
  status: string
  eligible_at: string | null
  stripe_transfer_id: string | null
  transferred_at: string | null
  stripe_payout_id: string | null
  stripe_payout_status: string | null
  stripe_payout_at: string | null
}

export type PayoutStatement = {
  payee_user_id: string
  period: string
  period_start: string
  period_end: string
  currency: string
  lines: StatementLine[]
  totals: {
    gross_source_amount: number
    earned: number
    adjustments: number
    held: number
    due: number
    paid: number
    reversed: number
    outstanding: number
    ytd_earned: number
    ytd_adjustments: number
    ytd_paid: number
  }
}

export type PayoutStatementPeriod = {
  key: string
  label: string
  start: string
  end: string
}

const OWED = new Set(['held', 'failed', 'skipped_no_connected_account'])

export function iso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
  const anyValue = value as any
  if (typeof anyValue?.toDate === 'function') return anyValue.toDate().toISOString()
  if (typeof anyValue?._seconds === 'number') return new Date(anyValue._seconds * 1000).toISOString()
  return null
}

export function previousCalendarMonth(now: Date): { key: string; start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { key: start.toISOString().slice(0, 7), start: start.toISOString(), end: end.toISOString() }
}

function localMidnightIso(year: number, month: number, day: number, timeZone = 'America/Denver'): string {
  const target = Date.UTC(year, month - 1, day)
  let instant = target
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])
    ) as Record<string, number>
    const rendered = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const correction = target - rendered
    instant += correction
    if (correction === 0) break
  }
  return new Date(instant).toISOString()
}

export function payoutCycleStatementPeriod(now: Date, timeZone = 'America/Denver'): PayoutStatementPeriod {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [year, month, day] = dateParts.split('-').map(Number)
  const startDay = day <= 15 ? 1 : 16
  return {
    key: `cycle-${dateParts}`,
    label: `${dateParts} payout`,
    start: localMidnightIso(year, month, startDay, timeZone),
    end: new Date(now.getTime() + 1).toISOString(),
  }
}

export function yearToDateStatementPeriod(now: Date, timeZone = 'America/Denver'): PayoutStatementPeriod {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [year] = dateParts.split('-').map(Number)
  return {
    key: `ytd-${dateParts}`,
    label: `${year} year-to-date`,
    start: localMidnightIso(year, 1, 1, timeZone),
    end: new Date(now.getTime() + 1).toISOString(),
  }
}

function eventAt(row: StatementTransfer): string | null {
  // Subscription and split commissions carry sale/accrual timestamps. A
  // deliberate one-off catch-up transfer is written by manualPayout() with a
  // Firestore created_at timestamp instead, and must still appear on the
  // payee's statement for the month in which CityBeat issued it.
  return iso(row.sale_at) || iso(row.accrued_at) || iso(row.created_at)
}

function transferredAt(row: StatementTransfer): string | null {
  const paidAt = iso(row.paid_at)
  if (paidAt) return paidAt
  // manualPayout() writes the successful Stripe transfer and ledger row in one
  // operation but legacy/manual rows do not carry a separate paid_at field.
  return row.status === 'paid' && row.stripe_transfer_id ? eventAt(row) : null
}

function adjustmentFor(row: StatementTransfer): number {
  const amount = Math.max(0, Math.round(Number(row.amount) || 0))
  const original = Math.max(amount, Math.round(Number(row.original_amount) || 0))
  if (row.status === 'reversed') return -original
  const refundAdjustment = Math.min(0, amount - original)
  const owedBack = Math.max(0, Math.round(Number(row.clawback_owed_amount) || 0))
  return refundAdjustment - owedBack
}

export function buildPayoutStatement(input: {
  payeeUserId: string
  period: Pick<PayoutStatementPeriod, 'key' | 'start' | 'end'>
  transfers: StatementTransfer[]
  payments?: StatementPayment[]
  now?: Date
}): PayoutStatement {
  const payments = new Map((input.payments || []).map((p) => [p.id, p]))
  const startMs = Date.parse(input.period.start)
  const endMs = Date.parse(input.period.end)
  const yearStartMs = Date.UTC(new Date(input.period.start).getUTCFullYear(), 0, 1)
  const nowMs = (input.now || new Date()).getTime()
  const rows = input.transfers.filter((r) => r.payee_user_id === input.payeeUserId)
  const inRange = (value: string | null, lo: number, hi: number) => {
    const ms = value ? Date.parse(value) : NaN
    return Number.isFinite(ms) && ms >= lo && ms < hi
  }

  let ytdEarned = 0
  let ytdAdjustments = 0
  let ytdPaid = 0
  for (const row of rows) {
    const earnedAt = eventAt(row)
    const amount = Math.max(0, Math.round(Number(row.original_amount ?? row.amount) || 0))
    if (inRange(earnedAt, yearStartMs, endMs)) {
      ytdEarned += amount
      ytdAdjustments += adjustmentFor(row)
    }
    if (inRange(transferredAt(row), yearStartMs, endMs)) ytdPaid += Math.max(0, Math.round(Number(row.amount) || 0))
  }

  const periodRows = rows.filter((row) =>
    inRange(eventAt(row), startMs, endMs) ||
    inRange(transferredAt(row), startMs, endMs) ||
    inRange(iso(row.clawback_at), startMs, endMs) ||
    inRange(iso(row.stripe_payout_at), startMs, endMs)
  )
  const lines = periodRows.map((row): StatementLine => {
    const payment = row.source_payment ? payments.get(row.source_payment) : undefined
    const gross = payment ? Math.max(0, Math.round(Number(payment.gross_amount ?? payment.amount) || 0)) : null
    return {
      ledger_id: row.id,
      source_payment: row.source_payment || null,
      gross_source_amount: gross,
      commission_rate: Number(row.percent) || 0,
      role: row.role || 'payee',
      service: row.service || 'unknown',
      earned: Math.max(0, Math.round(Number(row.original_amount ?? row.amount) || 0)),
      adjustment: adjustmentFor(row),
      earned_at: eventAt(row),
      adjustment_at: iso(row.clawback_at) || eventAt(row),
      status: row.status || 'unknown',
      eligible_at: iso(row.eligible_at),
      stripe_transfer_id: row.stripe_transfer_id || null,
      transferred_at: transferredAt(row),
      stripe_payout_id: row.stripe_payout_id || null,
      stripe_payout_status: row.stripe_payout_status || null,
      stripe_payout_at: iso(row.stripe_payout_at),
    }
  })

  const totals = {
    gross_source_amount: lines.filter((l) => inRange(l.earned_at, startMs, endMs)).reduce((n, l) => n + (l.gross_source_amount || 0), 0),
    earned: lines.filter((l) => inRange(l.earned_at, startMs, endMs)).reduce((n, l) => n + l.earned, 0),
    adjustments: lines.filter((l) => inRange(l.adjustment_at, startMs, endMs)).reduce((n, l) => n + l.adjustment, 0),
    held: 0,
    due: 0,
    paid: periodRows.filter((r) => inRange(transferredAt(r), startMs, endMs)).reduce((n, r) => n + Math.max(0, Math.round(Number(r.amount) || 0)), 0),
    reversed: periodRows.filter((r) => r.status === 'reversed' && inRange(iso(r.clawback_at) || eventAt(r), startMs, endMs)).reduce((n, r) => n + Math.max(0, Math.round(Number(r.original_amount ?? r.amount) || 0)), 0),
    outstanding: 0,
    ytd_earned: ytdEarned,
    ytd_adjustments: ytdAdjustments,
    ytd_paid: ytdPaid,
  }
  for (const row of rows) {
    if (!OWED.has(row.status || '')) continue
    const amount = Math.max(0, Math.round(Number(row.amount) || 0))
    totals.outstanding += amount
    const eligibleMs = Date.parse(iso(row.eligible_at) || '')
    if (row.status === 'held' && Number.isFinite(eligibleMs) && eligibleMs > nowMs) totals.held += amount
    else totals.due += amount
  }

  return {
    payee_user_id: input.payeeUserId,
    period: input.period.key,
    period_start: input.period.start,
    period_end: input.period.end,
    currency: rows.find((r) => r.currency)?.currency || 'usd',
    lines,
    totals,
  }
}

export function statementDeliveryId(payeeUserId: string, period: string): string {
  return `${period}_${payeeUserId.replace(/[^A-Za-z0-9_-]/g, '_')}`
}

export function canReserveStatementDelivery(status: unknown): boolean {
  return status === null || status === undefined || status === 'failed'
}

export function money(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c)
}

export function payoutStatementHtml(statement: PayoutStatement): string {
  const rows = statement.lines.length
    ? statement.lines.map((line) => `<tr><td>${esc(line.service)}</td><td>${esc(line.role)} · ${line.commission_rate}%</td><td>${esc(money(line.gross_source_amount || 0, statement.currency))}</td><td>${esc(money(line.earned + line.adjustment, statement.currency))}</td><td>${esc(line.status)}</td><td>${esc(line.stripe_transfer_id || 'Not transferred')}${line.transferred_at ? `<br>${esc(line.transferred_at.slice(0, 10))}` : ''}</td><td>${esc(line.stripe_payout_status || 'Not recorded by CityBeat')}${line.stripe_payout_at ? `<br>${esc(line.stripe_payout_at.slice(0, 10))}` : ''}</td></tr>`).join('')
    : '<tr><td colspan="7">No commission activity was recorded during this period.</td></tr>'
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:760px;margin:auto;color:#111"><h1>CityBeat commission statement</h1><p>${esc(statement.period_start.slice(0, 10))} through ${esc(new Date(Date.parse(statement.period_end) - 1).toISOString().slice(0, 10))}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th>Service</th><th>Role/rate</th><th>Customer payment</th><th>Commission</th><th>Ledger status</th><th>Stripe transfer</th><th>Bank payout</th></tr></thead><tbody>${rows}</tbody></table><h2>Period totals</h2><p>Earned: <strong>${esc(money(statement.totals.earned, statement.currency))}</strong> · Adjustments: ${esc(money(statement.totals.adjustments, statement.currency))} · Transferred: ${esc(money(statement.totals.paid, statement.currency))}</p><p>Held: ${esc(money(statement.totals.held, statement.currency))} · Due/failed: ${esc(money(statement.totals.due, statement.currency))} · Outstanding: <strong>${esc(money(statement.totals.outstanding, statement.currency))}</strong></p><h2>Year to date</h2><p>Earned: ${esc(money(statement.totals.ytd_earned, statement.currency))} · Adjustments: ${esc(money(statement.totals.ytd_adjustments, statement.currency))} · Transferred: ${esc(money(statement.totals.ytd_paid, statement.currency))}</p><p style="font-size:12px;color:#64748b">A Stripe transfer sends commission from CityBeat to your connected Stripe balance. A bank payout is shown only when CityBeat has a recorded Stripe payout identifier and status. No bank or card numbers appear in this statement.</p><p style="font-size:11px;color:#94a3b8">Commission transfers run on the 15th and final calendar day. CityBeat emails a statement with each payout cycle.</p></div>`
}
