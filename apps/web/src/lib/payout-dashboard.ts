export type PayeeLedgerRow = {
  id: string
  status?: string | null
  amount?: number | null
  original_amount?: number | null
  sale_at?: unknown
  accrued_at?: unknown
  created_at?: unknown
  paid_at?: unknown
  stripe_transfer_id?: string | null
}

function timestampMs(value: unknown): number | null {
  if (!value) return null
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const shaped = value as any
  if (typeof shaped?.toDate === 'function') return shaped.toDate().getTime()
  if (typeof shaped?._seconds === 'number') return shaped._seconds * 1000
  return null
}

function earnedMs(row: PayeeLedgerRow): number | null {
  return timestampMs(row.sale_at) ?? timestampMs(row.accrued_at) ?? timestampMs(row.created_at)
}

function transferredMs(row: PayeeLedgerRow): number | null {
  return timestampMs(row.paid_at) ?? (row.status === 'paid' && row.stripe_transfer_id ? timestampMs(row.created_at) : null)
}

export function buildPayeePayoutSummary(rows: PayeeLedgerRow[], now = new Date()) {
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1)
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const end = now.getTime() + 1
  const within = (value: number | null, start: number) => value !== null && value >= start && value < end
  const paidRows = rows.filter((row) => row.status === 'paid' && Boolean(row.stripe_transfer_id))
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
  const earnedAmount = (row: PayeeLedgerRow) => Math.max(0, Math.round(Number(row.original_amount ?? row.amount) || 0))
  const paidAmount = (row: PayeeLedgerRow) => Math.max(0, Math.round(Number(row.amount) || 0))

  return {
    commission_transfer_count: paidRows.length,
    ytd_earned: sum(rows.filter((row) => within(earnedMs(row), yearStart)).map(earnedAmount)),
    ytd_paid: sum(paidRows.filter((row) => within(transferredMs(row), yearStart)).map(paidAmount)),
    month_earned: sum(rows.filter((row) => within(earnedMs(row), monthStart)).map(earnedAmount)),
    month_paid: sum(paidRows.filter((row) => within(transferredMs(row), monthStart)).map(paidAmount)),
  }
}
