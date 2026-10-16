// Listing-scoped analytics: privacy-safe event aggregation for directory
// listings. No visitor identity is ever stored — events land as per-day counters
// in `listing_stats/{listingId}_{YYYYMMDD}` docs and are aggregated here.
// Pure + tested so the owner-facing numbers are trustworthy.

export const LISTING_EVENT_TYPES = [
  'view',
  'click_website',
  'click_directions',
  'click_action',
  'click_phone',
  'click_social_facebook',
  'click_social_instagram',
  'click_social_twitter',
  'click_directions_google',
  'click_directions_apple',
  'click_directions_location',
  'click_action_booking',
  'click_action_order',
  'click_action_quote',
  'click_action_menu',
  'click_post_cta',
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
  external_site_view?: number
  external_conversion?: number
} & Partial<Record<ListingEventType, number>>

export type StatTotals = {
  view: number
  click_website: number
  click_directions: number
  click_action: number
  lead: number
  click_phone: number
  click_social_facebook: number
  click_social_instagram: number
  click_social_twitter: number
  click_directions_google: number
  click_directions_apple: number
  click_directions_location: number
  click_action_booking: number
  click_action_order: number
  click_action_quote: number
  click_action_menu: number
  click_post_cta: number
  external_site_view: number
  external_conversion: number
}

const ZERO: StatTotals = {
  view: 0, click_website: 0, click_directions: 0, click_action: 0, lead: 0,
  click_phone: 0, click_social_facebook: 0, click_social_instagram: 0, click_social_twitter: 0,
  click_directions_google: 0, click_directions_apple: 0, click_directions_location: 0,
  click_action_booking: 0, click_action_order: 0, click_action_quote: 0, click_action_menu: 0, click_post_cta: 0,
  external_site_view: 0, external_conversion: 0,
}

function addRow(acc: StatTotals, row: DailyStatRow): StatTotals {
  return {
    view: acc.view + (Number(row.view) || 0),
    click_website: acc.click_website + (Number(row.click_website) || 0),
    click_directions: acc.click_directions + (Number(row.click_directions) || 0),
    click_action: acc.click_action + (Number(row.click_action) || 0),
    lead: acc.lead + (Number(row.lead) || 0),
    click_phone: acc.click_phone + (Number(row.click_phone) || 0),
    click_social_facebook: acc.click_social_facebook + (Number(row.click_social_facebook) || 0),
    click_social_instagram: acc.click_social_instagram + (Number(row.click_social_instagram) || 0),
    click_social_twitter: acc.click_social_twitter + (Number(row.click_social_twitter) || 0),
    click_directions_google: acc.click_directions_google + (Number(row.click_directions_google) || 0),
    click_directions_apple: acc.click_directions_apple + (Number(row.click_directions_apple) || 0),
    click_directions_location: acc.click_directions_location + (Number(row.click_directions_location) || 0),
    click_action_booking: acc.click_action_booking + (Number(row.click_action_booking) || 0),
    click_action_order: acc.click_action_order + (Number(row.click_action_order) || 0),
    click_action_quote: acc.click_action_quote + (Number(row.click_action_quote) || 0),
    click_action_menu: acc.click_action_menu + (Number(row.click_action_menu) || 0),
    click_post_cta: acc.click_post_cta + (Number(row.click_post_cta) || 0),
    external_site_view: acc.external_site_view + (Number(row.external_site_view) || 0),
    external_conversion: acc.external_conversion + (Number(row.external_conversion) || 0),
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
  const header = [
    'day', 'views', 'website_clicks', 'direction_clicks', 'action_clicks', 'leads', 'phone_clicks',
    'facebook_clicks', 'instagram_clicks', 'twitter_clicks', 'google_direction_clicks',
    'apple_direction_clicks', 'location_direction_clicks', 'booking_clicks', 'order_clicks',
    'quote_clicks', 'menu_clicks', 'post_cta_clicks', 'external_site_views', 'external_conversions',
  ]
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
        csvCell(Number(row.click_phone) || 0),
        csvCell(Number(row.click_social_facebook) || 0),
        csvCell(Number(row.click_social_instagram) || 0),
        csvCell(Number(row.click_social_twitter) || 0),
        csvCell(Number(row.click_directions_google) || 0),
        csvCell(Number(row.click_directions_apple) || 0),
        csvCell(Number(row.click_directions_location) || 0),
        csvCell(Number(row.click_action_booking) || 0),
        csvCell(Number(row.click_action_order) || 0),
        csvCell(Number(row.click_action_quote) || 0),
        csvCell(Number(row.click_action_menu) || 0),
        csvCell(Number(row.click_post_cta) || 0),
        csvCell(Number(row.external_site_view) || 0),
        csvCell(Number(row.external_conversion) || 0),
      ].join(',')
    )
  }
  return lines.join('\r\n')
}
