import { adminDb } from '@citybeat/lib/firebase/admin'

export type PublicEvent = {
  id: string
  title_en: string
  title_es: string
  meta_en?: string
  meta_es?: string
  venue?: string | null
  start_date: string
  ticket_url?: string | null
  image_url?: string | null
  featured?: boolean
}

// Visible to the public = explicitly approved, or a legacy event predating
// the status field. This is an ALLOW-list on purpose: the old deny-list
// (status !== 'pending' && status !== 'rejected') let every unknown status
// through — including 'needs_attention', which the Stripe refund path stamps
// on a refunded paid event. A refund was therefore PUBLISHING the event, and
// featured:true then pinned it to the top of /events. Any NEW status must be
// added here explicitly to become public.
export function isEventVisible(e: { status?: unknown }): boolean {
  return !e.status || e.status === 'approved'
}
const isVisible = isEventVisible

// Reading the ENTIRE `events` collection ordered oldest-first and throwing away
// all but `limit` was the same shape of bug as the homepage article read: the
// homepage, /events and the sitemap each paid one billed Firestore read per
// event ever created — every long-past one included — to render at most a few
// dozen, and the bill grew every night as citybeat-sync-events pulled in more
// Ticketmaster rows. Firestore can answer this natively: a range filter on
// start_date plus an orderBy on the SAME field is served by the automatic
// single-field index, so it needs no composite index (which is what the full
// scan was avoiding in the first place).
//
// The bound is compared as a STRING because that is how start_date is stored,
// in two shapes: full ISO with Z (api/events/submit, lib/events-scraper) and
// naive local `YYYY-MM-DDTHH:mm:ss` (lib/sales-fulfillment). Both begin with
// YYYY-MM-DD, so a date-only bound orders correctly against either, and
// offsetDays of slack keeps the precise cutoff — plus any timezone skew between
// the two shapes — decided in memory, exactly where it was before.
// Consequence worth knowing: a row whose start_date does NOT begin with a date
// now sorts outside the window instead of being kept by the NaN branch below.
// Every writer in this repo stores an ISO-prefixed value.
function dateBound(ms: number, offsetDays: number): string {
  return new Date(ms + offsetDays * 86400000).toISOString().slice(0, 10)
}

// Backstop so a runaway calendar can never OOM the container. Because the read
// is now soonest-first, hitting it means a featured (paid) event further out
// than the next 500 upcoming events would not be pulled forward by the sort
// below — more than a year of El Paso listings at current volume.
const EVENTS_SCAN_CAP = 500

export async function getUpcomingEvents(limit = 60): Promise<PublicEvent[]> {
  try {
    const cutoff = Date.now() - 12 * 60 * 60 * 1000 // keep events up to 12h past start
    // Headroom over `limit`: the visibility allow-list and the featured-first
    // re-sort both run after the read, so the query has to return more rows than
    // the caller asked for.
    const scan = Math.min(Math.max(limit * 4, 100), EVENTS_SCAN_CAP)
    const snap = await adminDb
      .collection('events')
      .where('start_date', '>=', dateBound(cutoff, -2))
      .orderBy('start_date', 'asc')
      .limit(scan)
      .get()
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter(isVisible)
      .filter((e) => {
        const t = Date.parse(e.start_date)
        return Number.isNaN(t) || t >= cutoff
      })
      // Featured (paid) events first, then by start date (already asc from query).
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
      .slice(0, limit)
  } catch {
    return []
  }
}

// The upcoming Fri–Sun window. Mon–Thu → the coming weekend; Fri/Sat/Sun →
// from now through this Sunday night. Used by the /this-weekend traffic page.
export function thisWeekendWindow(now = new Date()): { start: number; end: number; label: string } {
  const d = new Date(now)
  const dow = d.getDay() // 0 Sun .. 6 Sat
  // Days until Friday (5). If already Fri/Sat/Sun, the weekend has started.
  const daysToFri = (5 - dow + 7) % 7
  const friday = new Date(d)
  friday.setHours(0, 0, 0, 0)
  if (dow === 0) {
    // Sunday: weekend is Fri(-2)..today
    friday.setDate(d.getDate() - 2)
  } else if (dow === 6) {
    friday.setDate(d.getDate() - 1)
  } else if (dow >= 1 && dow <= 4) {
    friday.setDate(d.getDate() + daysToFri)
  }
  const sundayEnd = new Date(friday)
  sundayEnd.setDate(friday.getDate() + 2)
  sundayEnd.setHours(23, 59, 59, 999)
  const start = Math.max(now.getTime(), friday.getTime())
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { start, end: sundayEnd.getTime(), label: `${fmt(friday)}–${fmt(sundayEnd)}` }
}

export async function getThisWeekendEvents(): Promise<{ events: PublicEvent[]; label: string }> {
  const { start, end, label } = thisWeekendWindow()
  try {
    // Same range-filter reasoning as getUpcomingEvents, bounded on both sides:
    // this page needs three days of events, not the whole calendar. The \uf8ff
    // suffix makes the upper bound include every time-of-day on the last day;
    // the in-memory window check below still decides the exact edges.
    const snap = await adminDb
      .collection('events')
      .where('start_date', '>=', dateBound(start, -1))
      .where('start_date', '<=', `${dateBound(end, 1)}\uf8ff`)
      .orderBy('start_date', 'asc')
      .limit(EVENTS_SCAN_CAP)
      .get()
    const events = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter(isVisible)
      .filter((e) => {
        const t = Date.parse(e.start_date)
        return !Number.isNaN(t) && t >= start && t <= end
      })
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Date.parse(a.start_date) - Date.parse(b.start_date))
    return { events, label }
  } catch {
    return { events: [], label }
  }
}

export async function getEventById(id: string): Promise<PublicEvent | null> {
  try {
    const doc = await adminDb.collection('events').doc(id).get()
    if (!doc.exists) return null
    const e = { id: doc.id, ...(doc.data() as any) }
    return isVisible(e) ? (e as PublicEvent) : null
  } catch {
    return null
  }
}
