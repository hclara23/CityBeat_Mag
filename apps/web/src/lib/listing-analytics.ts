// Listing-scoped analytics: privacy-safe event aggregation for directory
// listings. No visitor identity is ever stored — events land as per-day counters
// in `listing_stats/{listingId}_{YYYYMMDD}` docs and are aggregated here.
// Pure + tested so the owner-facing numbers are trustworthy.

export const LISTING_EVENT_TYPES = [
  'view',
  'click_website',
  'click_directions',
  'click_action',
  'lead',
] as const

export type ListingEventType = (typeof LISTING_EVENT_TYPES)[number]

export function isValidListingEventType(value: unknown): value is ListingEventType {
  return (LISTING_EVENT_TYPES as readonly string[]).includes(value as string)
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// One aggregate doc per listing per day. The underscore join is safe because
// Firestore doc ids can't contain '/' and listing ids never contain '_2' date
// suffix collisions (date is fixed-width).
export function statsDocId(listingId: string, day: string): string {
  return `${listingId}_${day}`
}

export type DailyStatRow = {
  day: string // YYYY-MM-DD
  view?: number
  click_website?: number
  click_directions?: number
  click_action?: number
  lead?: number
}

export type StatTotals = {
  view: number
  click_website: number
  click_directions: number
  click_action: number
  lead: number
}

const ZERO: StatTotals = { view: 0, click_website: 0, click_directions: 0, click_action: 0, lead: 0 }

function addRow(acc: StatTotals, row: DailyStatRow): StatTotals {
  return {
    view: acc.view + (Number(row.view) || 0),
    click_website: acc.click_website + (Number(row.click_website) || 0),
    click_directions: acc.click_directions + (Number(row.click_directions) || 0),
    click_action: acc.click_action + (Number(row.click_action) || 0),
    lead: acc.lead + (Number(row.lead) || 0),
  }
}

export function totalsForRange(rows: DailyStatRow[], startDay: string, endDay: string): StatTotals {
  return rows
    .filter((r) => r.day >= startDay && r.day <= endDay)
    .reduce(addRow, { ...ZERO })
}

export function daysAgoKey(now: Date, days: number): string {
  return dayKey(new Date(now.getTime() - days * 24 * 60 * 60 * 1000))
}

export type AnalyticsSummary = {
  window_days: number
  current: StatTotals
  previous: StatTotals // the window immediately before, for comparison
  series: { day: string; view: number; lead: number; clicks: number }[]
}

// The full owner summary: current window totals, prior-window comparison, and a
// contiguous daily series (zero-filled so charts don't skip quiet days).
export function summarizeListingStats(rows: DailyStatRow[], now: Date, windowDays = 30): AnalyticsSummary {
  const endDay = dayKey(now)
  const startDay = daysAgoKey(now, windowDays - 1)
  const prevEndDay = daysAgoKey(now, windowDays)
  const prevStartDay = daysAgoKey(now, windowDays * 2 - 1)

  const byDay = new Map(rows.map((r) => [r.day, r]))
  const series: AnalyticsSummary['series'] = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = daysAgoKey(now, i)
    const row = byDay.get(day)
    series.push({
      day,
      view: Number(row?.view) || 0,
      lead: Number(row?.lead) || 0,
      clicks:
        (Number(row?.click_website) || 0) +
        (Number(row?.click_directions) || 0) +
        (Number(row?.click_action) || 0),
    })
  }

  return {
    window_days: windowDays,
    current: totalsForRange(rows, startDay, endDay),
    previous: totalsForRange(rows, prevStartDay, prevEndDay),
    series,
  }
}

// Percentage change for the comparison chips; null = no prior baseline.
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0
  return Math.round(((current - previous) / previous) * 100)
}

// --- CSV export (analyticsExport entitlement) ---

// Excel/Sheets treat leading = + - @ as formulas — prefix with ' so a hostile
// value can never execute in the owner's spreadsheet (formula injection).
export function csvCell(value: unknown): string {
  let v = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`
  return v
}

export function statsToCsv(rows: DailyStatRow[]): string {
  const header = ['day', 'views', 'website_clicks', 'direction_clicks', 'action_clicks', 'leads']
  const lines = [header.join(',')]
  for (const row of [...rows].sort((a, b) => a.day.localeCompare(b.day))) {
    lines.push(
      [
        csvCell(row.day),
        csvCell(Number(row.view) || 0),
        csvCell(Number(row.click_website) || 0),
        csvCell(Number(row.click_directions) || 0),
        csvCell(Number(row.click_action) || 0),
        csvCell(Number(row.lead) || 0),
      ].join(',')
    )
  }
  return lines.join('\r\n')
}
